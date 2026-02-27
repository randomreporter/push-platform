import express from 'express';
import prisma from '../../lib/prisma.js';
import { getBroadcastQueue } from '../../services/queue.js';
import { dispatchCampaignInline } from '../../services/pushDispatch.js';

const router = express.Router();

// GET /api/admin/campaigns
router.get('/', async (req, res, next) => {
    try {
        const { site_id, status, page = 1, limit = 20 } = req.query;
        const where = {};
        if (site_id) where.siteId = Number(site_id);
        if (status) where.status = status;

        const [campaigns, total] = await Promise.all([
            prisma.campaign.findMany({
                where, orderBy: { createdAt: 'desc' },
                skip: (Number(page) - 1) * Number(limit), take: Number(limit)
            }),
            prisma.campaign.count({ where })
        ]);
        res.json({ campaigns, total, page: Number(page), limit: Number(limit) });
    } catch (err) { next(err); }
});

// POST /api/admin/campaigns
router.post('/', async (req, res, next) => {
    try {
        const { siteId, title, body, iconUrl, badgeUrl, imageUrl, targetUrl, segmentFilters, scheduledAt } = req.body;
        if (!siteId || !title || !body || !targetUrl) {
            return res.status(400).json({ error: 'validation_error', message: 'siteId, title, body, and targetUrl are required.' });
        }
        const site = await prisma.site.findUnique({ where: { id: Number(siteId) } });
        if (!site) return res.status(404).json({ error: 'not_found', message: 'Site not found.' });

        const campaign = await prisma.campaign.create({
            data: {
                siteId: Number(siteId), title, body, iconUrl, badgeUrl, imageUrl, targetUrl,
                segmentFilters: segmentFilters ? JSON.stringify(segmentFilters) : null,
                status: scheduledAt ? 'scheduled' : 'draft',
                scheduledAt: scheduledAt ? new Date(scheduledAt) : null
            }
        });
        res.status(201).json({ campaign });
    } catch (err) { next(err); }
});

// GET /api/admin/campaigns/:id
router.get('/:id', async (req, res, next) => {
    try {
        const campaign = await prisma.campaign.findUnique({ where: { id: Number(req.params.id) } });
        if (!campaign) return res.status(404).json({ error: 'not_found', message: 'Campaign not found.' });
        const ctr = campaign.deliveredCount > 0
            ? ((campaign.clickedCount / campaign.deliveredCount) * 100).toFixed(2)
            : '0.00';
        res.json({ campaign: { ...campaign, ctr: `${ctr}%` } });
    } catch (err) { next(err); }
});

// POST /api/admin/campaigns/:id/send
router.post('/:id/send', async (req, res, next) => {
    try {
        const campaign = await prisma.campaign.findUnique({
            where: { id: Number(req.params.id) }
        });
        if (!campaign) return res.status(404).json({ error: 'not_found', message: 'Campaign not found.' });
        if (['dispatching', 'completed'].includes(campaign.status)) {
            return res.status(409).json({ error: 'conflict', message: `Campaign is already ${campaign.status}.` });
        }

        // Try BullMQ first (only if Redis is actually available)
        let queueUsed = false;
        try {
            const queue = getBroadcastQueue();
            if (queue) {
                await queue.add('broadcast-campaign', { campaignId: campaign.id });
                await prisma.campaign.update({ where: { id: campaign.id }, data: { status: 'dispatching' } });
                queueUsed = true;
                return res.status(202).json({ message: 'Campaign enqueued via Redis queue.', campaignId: campaign.id });
            }
        } catch (redisErr) {
            console.warn('[Campaign] Redis unavailable, switching to inline dispatch:', redisErr.code || redisErr.message);
        }

        if (!queueUsed) {
            // Inline dispatch — non-blocking, responds immediately
            res.status(202).json({
                message: 'Campaign dispatch started.',
                campaignId: campaign.id,
                mode: 'inline'
            });

            // Run in background without keeping request open
            setTimeout(async () => {
                try {
                    const result = await dispatchCampaignInline(campaign.id);
                    console.log(`[Campaign ${campaign.id}] Dispatch complete:`, result);
                } catch (err) {
                    console.error(`[Campaign ${campaign.id}] Dispatch failed:`, err.message);
                    await prisma.campaign.update({
                        where: { id: campaign.id },
                        data: { status: 'draft' }
                    }).catch(() => { });
                }
            }, 0);
        }
    } catch (err) { next(err); }
});

// PUT /api/admin/campaigns/:id
router.put('/:id', async (req, res, next) => {
    try {
        const { title, body, iconUrl, badgeUrl, imageUrl, targetUrl, segmentFilters, scheduledAt } = req.body;
        const campaign = await prisma.campaign.update({
            where: { id: Number(req.params.id) },
            data: {
                title, body, iconUrl, badgeUrl, imageUrl, targetUrl,
                segmentFilters: segmentFilters ? JSON.stringify(segmentFilters) : null,
                scheduledAt: scheduledAt ? new Date(scheduledAt) : null
            }
        });
        res.json({ campaign });
    } catch (err) { next(err); }
});

// DELETE /api/admin/campaigns/:id
router.delete('/:id', async (req, res, next) => {
    try {
        const campaign = await prisma.campaign.findUnique({ where: { id: Number(req.params.id) } });
        if (!campaign) return res.status(404).json({ error: 'not_found', message: 'Campaign not found.' });
        if (campaign.status === 'dispatching') {
            return res.status(409).json({ error: 'conflict', message: 'Cannot delete a campaign currently dispatching.' });
        }
        await prisma.campaign.delete({ where: { id: Number(req.params.id) } });
        res.status(204).send();
    } catch (err) { next(err); }
});

export default router;
