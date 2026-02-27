import express from 'express';
import prisma from '../../lib/prisma.js';

const router = express.Router();

// GET /api/admin/analytics/overview
router.get('/overview', async (req, res, next) => {
    try {
        const { site_id } = req.query;
        const siteWhere = site_id ? { siteId: Number(site_id) } : {};

        const now = new Date();
        const weekAgo = new Date(now - 7 * 86400000);
        const monthAgo = new Date(now - 30 * 86400000);

        const [total, thisWeek, thisMonth, countByBrowser, countByOs, countByCountry] = await Promise.all([
            prisma.subscriber.count({ where: { ...siteWhere, status: 'active' } }),
            prisma.subscriber.count({ where: { ...siteWhere, status: 'active', createdAt: { gte: weekAgo } } }),
            prisma.subscriber.count({ where: { ...siteWhere, status: 'active', createdAt: { gte: monthAgo } } }),
            prisma.subscriber.groupBy({ by: ['browser'], where: { ...siteWhere, status: 'active' }, _count: { browser: true }, orderBy: { _count: { browser: 'desc' } }, take: 6 }),
            prisma.subscriber.groupBy({ by: ['os'], where: { ...siteWhere, status: 'active' }, _count: { os: true }, orderBy: { _count: { os: 'desc' } }, take: 6 }),
            prisma.subscriber.groupBy({ by: ['country'], where: { ...siteWhere, status: 'active' }, _count: { country: true }, orderBy: { _count: { country: 'desc' } }, take: 20 })
        ]);

        res.json({
            subscribers: { total, thisWeek, thisMonth },
            byBrowser: countByBrowser.map(r => ({ browser: r.browser || 'Unknown', count: r._count.browser })),
            byOs: countByOs.map(r => ({ os: r.os || 'Unknown', count: r._count.os })),
            byCountry: countByCountry.map(r => ({ country: r.country || 'Unknown', count: r._count.country }))
        });
    } catch (err) { next(err); }
});

// GET /api/admin/analytics/campaigns/:id
router.get('/campaigns/:id', async (req, res, next) => {
    try {
        const campaign = await prisma.campaign.findUnique({ where: { id: Number(req.params.id) } });
        if (!campaign) return res.status(404).json({ error: 'not_found', message: 'Campaign not found.' });

        const ctr = campaign.deliveredCount > 0
            ? ((campaign.clickedCount / campaign.deliveredCount) * 100).toFixed(2)
            : '0.00';

        const deliveryRate = campaign.targetedCount > 0
            ? ((campaign.deliveredCount / campaign.targetedCount) * 100).toFixed(2)
            : '0.00';

        res.json({
            campaign,
            stats: { ctr: `${ctr}%`, deliveryRate: `${deliveryRate}%` }
        });
    } catch (err) { next(err); }
});

export default router;
