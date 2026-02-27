import express from 'express';
import prisma from '../lib/prisma.js';

const router = express.Router();

// GET /api/site/:id/config
router.get('/:id/config', async (req, res, next) => {
    try {
        const site = await prisma.site.findUnique({
            where: { id: Number(req.params.id) },
            select: { id: true, vapidPublicKey: true, promptMode: true, promptDelayMs: true }
        });
        if (!site) return res.status(404).json({ error: 'not_found', message: 'Site not found.' });

        res.json({
            site_id: site.id,
            vapid_public_key: site.vapidPublicKey,
            sw_url: `${process.env.APP_URL}/sdk/sw.js`,
            prompt_mode: site.promptMode,
            prompt_delay_ms: site.promptDelayMs
        });
    } catch (err) { next(err); }
});

export default router;
