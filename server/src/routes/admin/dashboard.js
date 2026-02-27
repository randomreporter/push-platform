import express from 'express';
import prisma from '../../lib/prisma.js';

const router = express.Router();

// GET /api/admin — Overview dashboard metrics
router.get('/', async (req, res, next) => {
    try {
        const [totalSubscribers, totalCampaigns, recentCampaigns, newToday] = await Promise.all([
            prisma.subscriber.count({ where: { status: 'active' } }),
            prisma.campaign.count(),
            prisma.campaign.findMany({
                take: 10,
                orderBy: { createdAt: 'desc' },
                select: { id: true, title: true, status: true, targetedCount: true, deliveredCount: true, clickedCount: true, createdAt: true }
            }),
            prisma.subscriber.count({
                where: {
                    createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
                    status: 'active'
                }
            })
        ]);

        const campaignsWithCTR = recentCampaigns.map(c => ({
            ...c,
            ctr: c.deliveredCount > 0 ? ((c.clickedCount / c.deliveredCount) * 100).toFixed(2) + '%' : '0.00%'
        }));

        res.json({
            metrics: {
                totalSubscribers,
                newToday,
                totalCampaigns,
                activeCampaigns: recentCampaigns.filter(c => c.status === 'dispatching').length
            },
            recentCampaigns: campaignsWithCTR
        });
    } catch (err) { next(err); }
});

export default router;
