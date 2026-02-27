import express from 'express';
import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import prisma from '../../lib/prisma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

// GET /api/admin/subscribers
router.get('/', async (req, res, next) => {
    try {
        const { site_id, browser, os, country, status, page = 1, limit = 50 } = req.query;
        const where = {};
        if (site_id) where.siteId = Number(site_id);
        if (browser) where.browser = { contains: browser };
        if (os) where.os = { contains: os };
        if (country) where.country = country.toUpperCase();
        if (status) where.status = status;

        const [subscribers, total] = await Promise.all([
            prisma.subscriber.findMany({
                where,
                select: { id: true, siteId: true, browser: true, os: true, country: true, status: true, tags: true, lastSeenAt: true, createdAt: true },
                orderBy: { createdAt: 'desc' },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit)
            }),
            prisma.subscriber.count({ where })
        ]);

        res.json({ subscribers, total, page: Number(page), limit: Number(limit) });
    } catch (err) { next(err); }
});

// DELETE /api/admin/subscribers/:id
router.delete('/:id', async (req, res, next) => {
    try {
        await prisma.subscriber.delete({ where: { id: Number(req.params.id) } });
        res.status(204).send();
    } catch (err) { next(err); }
});

// POST /api/admin/subscribers/bulk-delete
router.post('/bulk-delete', async (req, res, next) => {
    try {
        const { site_id, browser, os, country, status, ids } = req.body;
        if (ids && Array.isArray(ids)) {
            const { count } = await prisma.subscriber.deleteMany({ where: { id: { in: ids.map(Number) } } });
            return res.json({ deleted: count });
        }
        const where = {};
        if (site_id) where.siteId = Number(site_id);
        if (browser) where.browser = browser;
        if (os) where.os = os;
        if (country) where.country = country;
        if (status) where.status = status;

        const { count } = await prisma.subscriber.deleteMany({ where });
        res.json({ deleted: count });
    } catch (err) { next(err); }
});

// GET /api/admin/subscribers/export — CSV
router.get('/export', async (req, res, next) => {
    try {
        const { site_id } = req.query;
        const where = site_id ? { siteId: Number(site_id) } : {};

        const subscribers = await prisma.subscriber.findMany({
            where,
            select: { id: true, browser: true, os: true, country: true, status: true, createdAt: true, lastSeenAt: true }
        });

        const tmpFile = path.join(__dirname, '../../../tmp_export.csv');
        const writer = createObjectCsvWriter({
            path: tmpFile,
            header: [
                { id: 'id', title: 'ID' }, { id: 'browser', title: 'Browser' }, { id: 'os', title: 'OS' },
                { id: 'country', title: 'Country' }, { id: 'status', title: 'Status' },
                { id: 'createdAt', title: 'Created At' }, { id: 'lastSeenAt', title: 'Last Seen' }
            ]
        });

        await writer.writeRecords(subscribers);
        res.download(tmpFile, 'subscribers.csv', () => {
            fs.unlink(tmpFile, () => { });
        });
    } catch (err) { next(err); }
});

export default router;
