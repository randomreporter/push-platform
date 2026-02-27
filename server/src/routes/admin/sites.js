import express from 'express';
import prisma from '../../lib/prisma.js';
import { generateVapidKeys, encryptPrivateKey } from '../../services/vapid.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// GET /api/admin/sites
router.get('/', async (req, res, next) => {
    try {
        const sites = await prisma.site.findMany({
            select: {
                id: true, name: true, domain: true, vapidPublicKey: true, promptMode: true, promptDelayMs: true, createdAt: true,
                _count: { select: { subscribers: { where: { status: 'active' } } } }
            }
        });
        res.json({ sites });
    } catch (err) { next(err); }
});

// POST /api/admin/sites
router.post('/', async (req, res, next) => {
    try {
        const { name, domain, defaultIconUrl, defaultBadgeUrl, promptMode, promptDelayMs } = req.body;
        if (!name || !domain) return res.status(400).json({ error: 'validation_error', message: 'name and domain are required.' });

        const existing = await prisma.site.findUnique({ where: { domain } });
        if (existing) return res.status(409).json({ error: 'conflict', message: 'A site with this domain already exists.' });

        const keys = generateVapidKeys();
        const sdkToken = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');

        const site = await prisma.site.create({
            data: {
                name, domain, defaultIconUrl, defaultBadgeUrl,
                vapidPublicKey: keys.publicKey,
                vapidPrivateKeyEnc: encryptPrivateKey(keys.privateKey),
                sdkToken, promptMode: promptMode || 'native', promptDelayMs: promptDelayMs || 3000
            }
        });

        const embedCode = generateEmbedCode(site);
        res.status(201).json({ site: { id: site.id, name: site.name, domain: site.domain, vapidPublicKey: site.vapidPublicKey, sdkToken: site.sdkToken }, embedCode });
    } catch (err) { next(err); }
});

// GET /api/admin/sites/:id
router.get('/:id', async (req, res, next) => {
    try {
        const site = await prisma.site.findUnique({
            where: { id: Number(req.params.id) },
            select: {
                id: true, name: true, domain: true, vapidPublicKey: true, sdkToken: true, promptMode: true, promptDelayMs: true,
                defaultIconUrl: true, defaultBadgeUrl: true, createdAt: true
            }
        });
        if (!site) return res.status(404).json({ error: 'not_found', message: 'Site not found.' });

        const embedCode = generateEmbedCode(site);
        res.json({ site, embedCode });
    } catch (err) { next(err); }
});

// PUT /api/admin/sites/:id
router.put('/:id', async (req, res, next) => {
    try {
        const { name, defaultIconUrl, defaultBadgeUrl, promptMode, promptDelayMs } = req.body;
        const site = await prisma.site.update({
            where: { id: Number(req.params.id) },
            data: { name, defaultIconUrl, defaultBadgeUrl, promptMode, promptDelayMs }
        });
        res.json({ site });
    } catch (err) { next(err); }
});

// DELETE /api/admin/sites/:id
router.delete('/:id', async (req, res, next) => {
    try {
        await prisma.site.delete({ where: { id: Number(req.params.id) } });
        res.status(204).send();
    } catch (err) { next(err); }
});

function generateEmbedCode(site) {
    const appUrl = process.env.APP_URL || 'http://localhost:3001';
    return `<script>
  (function() {
    window.PushPlatformConfig = {
      siteId: ${site.id},
      apiUrl: '${appUrl}',
      sdkToken: '${site.sdkToken}'
    };
    var s = document.createElement('script');
    s.src = '${appUrl}/sdk/push-sdk.js';
    s.async = true;
    document.head.appendChild(s);
  })();
</script>`;
}

export default router;
