import crypto from 'crypto';
import prisma from '../lib/prisma.js';

/**
 * Emit a webhook event to all registered active webhooks for a site.
 * Delivery is async (fire-and-forget) — failures are logged to WebhookDelivery.
 */
export async function emitWebhookEvent(siteId, eventName, data) {
    try {
        const webhooks = await prisma.webhook.findMany({
            where: { siteId, isActive: true }
        });

        for (const wh of webhooks) {
            let events = [];
            try { events = JSON.parse(wh.events); } catch { continue; }
            if (!events.includes(eventName)) continue;

            const payload = JSON.stringify({ event: eventName, site_id: siteId, timestamp: new Date().toISOString(), data });
            const sig = `sha256=${crypto.createHmac('sha256', wh.secretToken).update(payload).digest('hex')}`;

            // Store delivery record
            const delivery = await prisma.webhookDelivery.create({
                data: { webhookId: wh.id, eventName, payload, status: 'pending' }
            });

            // Fire async — don't await
            deliverWebhook(wh.targetUrl, payload, sig, delivery.id).catch(() => { });
        }
    } catch (err) {
        console.error('[Webhook] Error emitting event:', err.message);
    }
}

async function deliverWebhook(url, payload, signature, deliveryId, attempt = 1) {
    const MAX_ATTEMPTS = 3;
    const BACK_OFF = [0, 60_000, 300_000, 1_800_000]; // immediate, 1m, 5m, 30m

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Push-Signature': signature,
                'X-Push-Event': payload ? JSON.parse(payload)?.event : ''
            },
            body: payload,
            signal: controller.signal
        });
        clearTimeout(timer);

        await prisma.webhookDelivery.update({
            where: { id: deliveryId },
            data: { httpStatus: res.status, response: await res.text().catch(() => ''), status: res.ok ? 'success' : 'failed', attempt }
        });

        if (!res.ok && attempt < MAX_ATTEMPTS) {
            await wait(BACK_OFF[attempt]);
            await deliverWebhook(url, payload, signature, deliveryId, attempt + 1);
        }
    } catch (err) {
        await prisma.webhookDelivery.update({
            where: { id: deliveryId },
            data: { status: attempt < MAX_ATTEMPTS ? 'pending' : 'failed', response: err.message, attempt }
        }).catch(() => { });

        if (attempt < MAX_ATTEMPTS) {
            await wait(BACK_OFF[attempt]);
            await deliverWebhook(url, payload, signature, deliveryId, attempt + 1);
        }
    }
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));
