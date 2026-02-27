import express from 'express';
import prisma from '../lib/prisma.js';
import { hashEndpoint } from '../services/subscriber.js';

const router = express.Router();

const TAG_KEY_REGEX = /^[a-zA-Z0-9_]{1,64}$/;
const MAX_TAGS = 100;

// POST /api/subscriber/tags
router.post('/', async (req, res, next) => {
    try {
        const { endpoint, tags } = req.body;
        const sdkToken = req.headers['x-site-token'];

        if (!endpoint) return res.status(400).json({ error: 'validation_error', message: 'endpoint is required.' });
        if (!tags || typeof tags !== 'object') return res.status(400).json({ error: 'validation_error', message: 'tags must be an object.' });
        if (!sdkToken) return res.status(401).json({ error: 'invalid_token', message: 'X-Site-Token is required.' });

        // Validate tag key format
        for (const key of Object.keys(tags)) {
            if (!TAG_KEY_REGEX.test(key)) {
                return res.status(400).json({ error: 'validation_error', message: `Invalid tag key: "${key}". Keys must be alphanumeric (max 64 chars).` });
            }
            const val = String(tags[key]);
            if (val.length > 255) {
                return res.status(400).json({ error: 'validation_error', message: `Tag value for "${key}" exceeds 255 characters.` });
            }
        }

        const hash = hashEndpoint(endpoint);
        const subscriber = await prisma.subscriber.findUnique({ where: { endpointHash: hash } });
        if (!subscriber) return res.status(404).json({ error: 'not_found', message: 'Subscriber not found.' });

        const existingTags = JSON.parse(subscriber.tags || '{}');
        const merged = { ...existingTags, ...tags };

        if (Object.keys(merged).length > MAX_TAGS) {
            return res.status(413).json({ error: 'tag_limit_exceeded', message: `Subscribers may not hold more than ${MAX_TAGS} tags.` });
        }

        const updated = await prisma.subscriber.update({
            where: { endpointHash: hash },
            data: { tags: JSON.stringify(merged) }
        });

        res.json({ tags: JSON.parse(updated.tags) });
    } catch (err) { next(err); }
});

// DELETE /api/subscriber/tags/:key
router.delete('/:key', async (req, res, next) => {
    try {
        const { endpoint } = req.body;
        if (!endpoint) return res.status(400).json({ error: 'validation_error', message: 'endpoint is required.' });

        const hash = hashEndpoint(endpoint);
        const subscriber = await prisma.subscriber.findUnique({ where: { endpointHash: hash } });
        if (!subscriber) return res.status(404).json({ error: 'not_found', message: 'Subscriber not found.' });

        const existing = JSON.parse(subscriber.tags || '{}');
        delete existing[req.params.key];

        await prisma.subscriber.update({ where: { endpointHash: hash }, data: { tags: JSON.stringify(existing) } });
        res.status(204).send();
    } catch (err) { next(err); }
});

export default router;
