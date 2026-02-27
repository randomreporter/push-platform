import express from 'express';
import prisma from '../lib/prisma.js';
import { hashEndpoint, detectBrowser, detectOS, detectCountry, getClientIp } from '../services/subscriber.js';

const router = express.Router();

// POST /api/subscribe
router.post('/', async (req, res, next) => {
    try {
        const { endpoint, p256dh, auth, browser, os, site_id } = req.body;
        if (!endpoint || !p256dh || !auth || !site_id) {
            return res.status(400).json({ error: 'validation_error', message: 'endpoint, p256dh, auth, and site_id are required.', details: {} });
        }

        // Validate site + SDK token
        const sdkToken = req.headers['x-site-token'];
        const site = await prisma.site.findFirst({ where: { id: Number(site_id), sdkToken } });
        if (!site) return res.status(401).json({ error: 'invalid_token', message: 'Invalid X-Site-Token or site_id.' });

        const endpointHash = hashEndpoint(endpoint);
        const ip = getClientIp(req);
        const detectedBrowser = browser || detectBrowser(req.headers['user-agent']);
        const detectedOs = os || detectOS(req.headers['user-agent']);
        const country = detectCountry(ip);

        const existing = await prisma.subscriber.findUnique({ where: { endpointHash } });

        if (existing) {
            const updated = await prisma.subscriber.update({
                where: { endpointHash },
                data: { p256dh, auth, status: 'active', updatedAt: new Date() }
            });
            return res.json({ subscriber_id: updated.id, updated: true });
        }

        const subscriber = await prisma.subscriber.create({
            data: { siteId: site.id, endpoint, endpointHash, p256dh, auth, browser: detectedBrowser, os: detectedOs, country }
        });

        res.status(201).json({ subscriber_id: subscriber.id });
    } catch (err) { next(err); }
});

// DELETE /api/unsubscribe
router.delete('/', async (req, res, next) => {
    try {
        const { endpoint } = req.body;
        if (!endpoint) return res.status(400).json({ error: 'validation_error', message: 'endpoint is required.' });

        const sdkToken = req.headers['x-site-token'];
        if (!sdkToken) return res.status(401).json({ error: 'invalid_token', message: 'X-Site-Token required.' });

        const hash = hashEndpoint(endpoint);
        const sub = await prisma.subscriber.findUnique({ where: { endpointHash: hash } });
        if (!sub) return res.status(404).json({ error: 'not_found', message: 'Subscription not found.' });

        await prisma.subscriber.delete({ where: { endpointHash: hash } });
        res.status(204).send();
    } catch (err) { next(err); }
});

export default router;
