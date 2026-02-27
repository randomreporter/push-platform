import express from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { generateVapidKeys } from '../services/vapid.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

const isInstalled = () => process.env.APP_INSTALLED === 'true';

// Block if already installed
router.use((req, res, next) => {
    if (isInstalled() && req.method !== 'GET') {
        return res.status(403).json({ error: 'forbidden', message: 'Setup wizard is disabled after installation.' });
    }
    next();
});

// GET /api/setup/status
router.get('/status', (req, res) => {
    res.json({ installed: isInstalled() });
});

// POST /api/setup/test-db — validate DB connection (always works for SQLite)
router.post('/test-db', async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ ok: true, message: 'Database connection successful.' });
    } catch (err) {
        res.status(500).json({ ok: false, message: err.message });
    }
});

// POST /api/setup/complete — run migrations equivalent + create admin
router.post('/complete', async (req, res, next) => {
    try {
        if (isInstalled()) {
            return res.status(403).json({ error: 'forbidden', message: 'Already installed.' });
        }

        const { adminName, adminEmail, adminPassword, appUrl, timezone } = req.body;

        if (!adminName || !adminEmail || !adminPassword) {
            return res.status(400).json({ error: 'validation_error', message: 'Admin name, email, and password are required.' });
        }
        if (adminPassword.length < 8) {
            return res.status(400).json({ error: 'validation_error', message: 'Password must be at least 8 characters.' });
        }

        // Check if admin already exists
        const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
        if (existing) {
            return res.status(409).json({ error: 'conflict', message: 'Admin user with this email already exists.' });
        }

        const hashed = await bcrypt.hash(adminPassword, 12);
        const admin = await prisma.user.create({
            data: { name: adminName, email: adminEmail, password: hashed, role: 'admin' }
        });

        // Update .env file to mark as installed
        const envPath = path.join(__dirname, '../../.env');
        if (fs.existsSync(envPath)) {
            let envContent = fs.readFileSync(envPath, 'utf-8');
            envContent = envContent.replace(/APP_INSTALLED=.*/g, 'APP_INSTALLED=true');
            if (appUrl) envContent = envContent.replace(/APP_URL=.*/g, `APP_URL=${appUrl}`);
            fs.writeFileSync(envPath, envContent);
            process.env.APP_INSTALLED = 'true';
        }

        res.json({
            message: 'Setup complete. You can now log in.',
            loginUrl: `${appUrl || process.env.APP_URL}/admin`,
            adminId: admin.id
        });
    } catch (err) { next(err); }
});

export default router;
