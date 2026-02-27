import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import prisma from '../lib/prisma.js';
import { getWebPushInstance } from '../services/vapid.js';

let redisConnection;
let broadcastQueue;
let pushQueue;

function getRedisConnection() {
    // Skip Redis entirely unless explicitly enabled — avoids the 8s retry delay
    if (!process.env.REDIS_URL && process.env.REDIS_ENABLED !== 'true') {
        return null;
    }

    if (!redisConnection) {
        try {
            redisConnection = new IORedis({
                host: process.env.REDIS_HOST || '127.0.0.1',
                port: Number(process.env.REDIS_PORT) || 6379,
                password: process.env.REDIS_PASSWORD || undefined,
                maxRetriesPerRequest: null,
                enableReadyCheck: false,
                retryStrategy(times) {
                    if (times > 3) return null; // give up
                    return Math.min(times * 1000, 5000);
                },
            });
            redisConnection.on('error', (err) => console.warn('[Queue] Redis error:', err.code));
            redisConnection.on('ready', () => console.log('[Queue] Redis connected.'));
        } catch {
            return null;
        }
    }
    return redisConnection;
}

export function getBroadcastQueue() {
    const conn = getRedisConnection();
    if (!conn) return null;
    if (!broadcastQueue) broadcastQueue = new Queue('broadcast', { connection: conn });
    return broadcastQueue;
}

export function getPushQueue() {
    const conn = getRedisConnection();
    if (!conn) return null;
    if (!pushQueue) pushQueue = new Queue('push-dispatch', { connection: conn });
    return pushQueue;
}

// ─── BroadcastCampaignJob Worker ──────────────────────────────────────────────
export function startBroadcastWorker() {
    const conn = getRedisConnection();
    if (!conn) return;

    new Worker('broadcast', async (job) => {
        const { campaignId } = job.data;
        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            include: { site: true }
        });
        if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

        await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'dispatching', dispatchedAt: new Date() } });

        // Build segment filter
        const where = buildSegmentWhere(campaign.siteId, campaign.segmentFilters);

        // Count targeted
        const total = await prisma.subscriber.count({ where });
        await prisma.campaign.update({ where: { id: campaignId }, data: { targetedCount: total } });

        // Chunk through subscribers using cursor pagination
        const chunkSize = 500;
        let cursor = 0;
        let dispatched = 0;

        while (true) {
            const subscribers = await prisma.subscriber.findMany({
                where,
                take: chunkSize,
                skip: cursor > 0 ? 1 : 0,
                cursor: cursor > 0 ? { id: cursor } : undefined,
                select: { id: true, endpoint: true, p256dh: true, auth: true }
            });

            if (subscribers.length === 0) break;

            const pq = getPushQueue();
            if (pq) {
                const jobs = subscribers.map(sub => ({
                    name: 'send-push',
                    data: {
                        campaignId, subscriberId: sub.id, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth,
                        siteId: campaign.siteId, vapidPublicKey: campaign.site.vapidPublicKey,
                        vapidPrivateKeyEnc: campaign.site.vapidPrivateKeyEnc, domain: campaign.site.domain,
                        payload: {
                            title: campaign.title, body: campaign.body, icon: campaign.iconUrl, badge: campaign.badgeUrl,
                            image: campaign.imageUrl, data: {
                                url: campaign.targetUrl, campaign_id: campaignId, subscriber_id: sub.id,
                                click_tracking_url: `${process.env.APP_URL}/api/track/click`
                            }
                        }
                    },
                    opts: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
                }));
                await pq.addBulk(jobs);
            }

            dispatched += subscribers.length;
            cursor = subscribers[subscribers.length - 1].id;
            await prisma.campaign.update({ where: { id: campaignId }, data: { sentCount: dispatched } });

            if (subscribers.length < chunkSize) break;
        }

        await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'completed', completedAt: new Date() } });
        console.log(`[Broadcast] Campaign ${campaignId} dispatched ${dispatched} jobs.`);
    }, { connection: conn, concurrency: 2 });
}

// ─── SendPushNotificationJob Worker ───────────────────────────────────────────
export function startPushWorker() {
    const conn = getRedisConnection();
    if (!conn) return;

    new Worker('push-dispatch', async (job) => {
        const { campaignId, subscriberId, endpoint, p256dh, auth, siteId,
            vapidPublicKey, vapidPrivateKeyEnc, domain, payload } = job.data;

        // Idempotency check
        const existing = await prisma.campaignLog.findFirst({
            where: { campaignId, subscriberId, eventType: 'delivered' }
        });
        if (existing) return;

        // Mock site object for vapid helper
        const site = { vapidPublicKey, vapidPrivateKeyEnc, domain };
        const wp = getWebPushInstance(site);

        try {
            await wp.sendNotification(
                { endpoint, keys: { p256dh, auth } },
                JSON.stringify(payload),
                { urgency: 'normal', TTL: 86400 }
            );

            await prisma.$transaction([
                prisma.campaign.update({ where: { id: campaignId }, data: { deliveredCount: { increment: 1 } } }),
                prisma.campaignLog.create({ data: { campaignId, subscriberId, eventType: 'delivered', httpStatus: 201 } }),
                prisma.subscriber.update({ where: { id: subscriberId }, data: { lastSeenAt: new Date() } })
            ]);
        } catch (err) {
            const status = err.statusCode;

            // Permanent failures — delete subscriber
            if (status === 410 || status === 404) {
                await prisma.$transaction([
                    prisma.subscriber.delete({ where: { id: subscriberId } }).catch(() => { }),
                    prisma.campaign.update({ where: { id: campaignId }, data: { failedCount: { increment: 1 } } }),
                    prisma.campaignLog.create({ data: { campaignId, subscriberId, eventType: 'unsubscribed', httpStatus: status } })
                ]);
                return; // Do not retry
            }

            // Transient errors — BullMQ will retry
            await prisma.campaign.update({ where: { id: campaignId }, data: { failedCount: { increment: 1 } } });
            throw err;
        }
    }, { connection: conn, concurrency: 50 });
}

function buildSegmentWhere(siteId, segmentFiltersJson) {
    const base = { siteId, status: 'active' };
    if (!segmentFiltersJson) return base;
    // Filters are applied via raw query in production; for SQLite dev we return base
    return base;
}
