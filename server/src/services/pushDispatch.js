/**
 * Push dispatch service — works without Redis.
 * Sends web-push notifications directly using the web-push library.
 * Used as the primary dispatch method in development (no Redis required).
 * In production with Redis, BullMQ workers in queue.js take over.
 */
import webpush from 'web-push';
import prisma from '../lib/prisma.js';
import { decryptPrivateKey } from './vapid.js';
import { emitWebhookEvent } from './webhook.js';

/**
 * Send a single push notification.
 * Returns { ok: true } or { ok: false, status, permanent }
 */
async function sendOne({ endpoint, p256dh, auth, vapidPublicKey, vapidPrivateKeyEnc, domain, payload }) {
    let privateKey;
    try {
        privateKey = decryptPrivateKey(vapidPrivateKeyEnc);
    } catch (e) {
        console.error('[Push] Failed to decrypt VAPID private key:', e.message);
        return { ok: false, status: 0, permanent: false };
    }

    webpush.setVapidDetails(
        `mailto:admin@${domain}`,
        vapidPublicKey,
        privateKey
    );

    try {
        await webpush.sendNotification(
            { endpoint, keys: { p256dh, auth } },
            JSON.stringify(payload),
            { urgency: 'normal', TTL: 86400 }
        );
        return { ok: true };
    } catch (err) {
        const status = err.statusCode || 0;
        const permanent = status === 410 || status === 404;
        if (!permanent) {
            console.error(`[Push] Delivery error ${status} for endpoint:`, err.body || err.message);
        }
        return { ok: false, status, permanent };
    }
}

/**
 * Dispatch a campaign to all its active subscribers.
 * Runs inline (no queue) — safe for small-to-medium lists.
 */
export async function dispatchCampaignInline(campaignId) {
    const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { site: true }
    });
    if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

    await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'dispatching', dispatchedAt: new Date() }
    });

    const subscribers = await prisma.subscriber.findMany({
        where: { siteId: campaign.siteId, status: 'active' },
        select: { id: true, endpoint: true, p256dh: true, auth: true }
    });

    const total = subscribers.length;
    console.log(`[Push] Campaign ${campaignId} → ${total} subscribers`);

    await prisma.campaign.update({
        where: { id: campaignId },
        data: { targetedCount: total }
    });

    if (total === 0) {
        await prisma.campaign.update({
            where: { id: campaignId },
            data: { status: 'completed', completedAt: new Date() }
        });
        return { total: 0, delivered: 0, failed: 0 };
    }

    const payload = {
        title: campaign.title,
        body: campaign.body,
        icon: campaign.iconUrl || undefined,
        badge: campaign.badgeUrl || undefined,
        image: campaign.imageUrl || undefined,
        data: {
            url: campaign.targetUrl,
            campaign_id: campaignId,
            click_tracking_url: `${process.env.APP_URL}/api/track/click`
        }
    };

    let delivered = 0;
    let failed = 0;
    const toDelete = [];

    // Process in parallel batches of 20 for speed
    const BATCH = 20;
    for (let i = 0; i < subscribers.length; i += BATCH) {
        const batch = subscribers.slice(i, i + BATCH);

        await Promise.all(batch.map(async (sub) => {
            // Idempotency — skip if already delivered
            const existing = await prisma.campaignLog.findFirst({
                where: { campaignId, subscriberId: sub.id, eventType: 'delivered' }
            });
            if (existing) { delivered++; return; }

            const result = await sendOne({
                endpoint: sub.endpoint,
                p256dh: sub.p256dh,
                auth: sub.auth,
                vapidPublicKey: campaign.site.vapidPublicKey,
                vapidPrivateKeyEnc: campaign.site.vapidPrivateKeyEnc,
                domain: campaign.site.domain,
                payload
            });

            if (result.ok) {
                delivered++;
                await prisma.campaignLog.create({
                    data: { campaignId, subscriberId: sub.id, eventType: 'delivered', httpStatus: 201 }
                }).catch((e) => { console.error('[Push] Log error:', e.message); });
                await prisma.subscriber.update({
                    where: { id: sub.id },
                    data: { lastSeenAt: new Date() }
                }).catch(() => { });
            } else {
                failed++;
                if (result.permanent) {
                    toDelete.push(sub.id);
                    await prisma.campaignLog.create({
                        data: { campaignId, subscriberId: sub.id, eventType: 'unsubscribed', httpStatus: result.status }
                    }).catch(() => { });
                } else {
                    await prisma.campaignLog.create({
                        data: { campaignId, subscriberId: sub.id, eventType: 'failed', httpStatus: result.status }
                    }).catch(() => { });
                }
            }
        }));

        // Update running totals after each batch
        await prisma.campaign.update({
            where: { id: campaignId },
            data: { sentCount: i + batch.length, deliveredCount: delivered, failedCount: failed }
        }).catch(() => { });
    }

    // Delete permanently invalid subscribers (410/404)
    if (toDelete.length > 0) {
        await prisma.subscriber.deleteMany({ where: { id: { in: toDelete } } }).catch(() => { });
        console.log(`[Push] Cleaned up ${toDelete.length} expired subscribers`);
    }

    await prisma.campaign.update({
        where: { id: campaignId },
        data: {
            status: 'completed',
            completedAt: new Date(),
            deliveredCount: delivered,
            failedCount: failed,
            sentCount: total
        }
    });

    await emitWebhookEvent(campaign.siteId, 'campaign.completed', {
        campaign_id: campaignId, total, delivered, failed
    }).catch(() => { });

    console.log(`[Push] Campaign ${campaignId} done — delivered: ${delivered}, failed: ${failed}`);
    return { total, delivered, failed };
}
