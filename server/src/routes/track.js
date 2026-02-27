import express from 'express';
import prisma from '../lib/prisma.js';
import { emitWebhookEvent } from '../services/webhook.js';

const router = express.Router();

// POST /api/track/click
router.post('/click', async (req, res, next) => {
    try {
        const { campaign_id, subscriber_id } = req.body;
        if (!campaign_id) return res.status(400).json({ error: 'validation_error', message: 'campaign_id is required.' });

        const campaign = await prisma.campaign.findUnique({ where: { id: Number(campaign_id) } });
        if (!campaign) return res.status(404).json({ error: 'not_found', message: 'Campaign not found.' });

        await prisma.$transaction([
            prisma.campaignLog.create({
                data: { campaignId: Number(campaign_id), subscriberId: subscriber_id ? Number(subscriber_id) : null, eventType: 'clicked' }
            }),
            prisma.campaign.update({
                where: { id: Number(campaign_id) },
                data: { clickedCount: { increment: 1 } }
            })
        ]);

        await emitWebhookEvent(campaign.siteId, 'notification.clicked', { campaign_id, subscriber_id });

        res.status(204).send();
    } catch (err) { next(err); }
});

// POST /api/track/dismiss
router.post('/dismiss', async (req, res, next) => {
    try {
        const { campaign_id, subscriber_id } = req.body;
        if (!campaign_id) return res.status(400).json({ error: 'validation_error', message: 'campaign_id is required.' });

        const campaign = await prisma.campaign.findUnique({ where: { id: Number(campaign_id) } });
        if (!campaign) return res.status(404).json({ error: 'not_found', message: 'Campaign not found.' });

        await prisma.$transaction([
            prisma.campaignLog.create({
                data: { campaignId: Number(campaign_id), subscriberId: subscriber_id ? Number(subscriber_id) : null, eventType: 'dismissed' }
            }),
            prisma.campaign.update({
                where: { id: Number(campaign_id) },
                data: { dismissedCount: { increment: 1 } }
            })
        ]);

        await emitWebhookEvent(campaign.siteId, 'notification.dismissed', { campaign_id, subscriber_id });
        res.status(204).send();
    } catch (err) { next(err); }
});

export default router;
