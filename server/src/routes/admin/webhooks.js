import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../../lib/prisma.js';

const router = express.Router();

// GET /api/admin/webhooks?site_id=X
router.get('/', async (req, res, next) => {
    try {
        const { site_id } = req.query;
        const where = site_id ? { siteId: Number(site_id) } : {};
        const webhooks = await prisma.webhook.findMany({ where, select: { id: true, siteId: true, targetUrl: true, events: true, isActive: true, createdAt: true } });
        res.json({ webhooks });
    } catch (err) { next(err); }
});

// POST /api/admin/webhooks
router.post('/', async (req, res, next) => {
    try {
        const { siteId, targetUrl, events } = req.body;
        if (!siteId || !targetUrl || !events?.length) {
            return res.status(400).json({ error: 'validation_error', message: 'siteId, targetUrl, and events are required.' });
        }
        if (!targetUrl.startsWith('https://')) {
            return res.status(400).json({ error: 'validation_error', message: 'targetUrl must use HTTPS.' });
        }
        const count = await prisma.webhook.count({ where: { siteId: Number(siteId) } });
        if (count >= 10) return res.status(400).json({ error: 'limit_exceeded', message: 'Maximum 10 webhooks per site.' });

        const secretToken = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
        const webhook = await prisma.webhook.create({
            data: { siteId: Number(siteId), targetUrl, events: JSON.stringify(events), secretToken }
        });
        res.status(201).json({ webhook: { ...webhook, secretToken } });
    } catch (err) { next(err); }
});

// PUT /api/admin/webhooks/:id
router.put('/:id', async (req, res, next) => {
    try {
        const { events, isActive } = req.body;
        const webhook = await prisma.webhook.update({
            where: { id: Number(req.params.id) },
            data: { events: events ? JSON.stringify(events) : undefined, isActive }
        });
        res.json({ webhook });
    } catch (err) { next(err); }
});

// DELETE /api/admin/webhooks/:id
router.delete('/:id', async (req, res, next) => {
    try {
        await prisma.webhook.delete({ where: { id: Number(req.params.id) } });
        res.status(204).send();
    } catch (err) { next(err); }
});

// GET /api/admin/webhooks/:id/deliveries
router.get('/:id/deliveries', async (req, res, next) => {
    try {
        const deliveries = await prisma.webhookDelivery.findMany({
            where: { webhookId: Number(req.params.id) },
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        res.json({ deliveries });
    } catch (err) { next(err); }
});

export default router;
