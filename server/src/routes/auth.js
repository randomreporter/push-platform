import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'validation_error', message: 'Email and password are required.' });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(401).json({ error: 'invalid_credentials', message: 'Invalid email or password.' });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: 'invalid_credentials', message: 'Invalid email or password.' });

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'dev-jwt-secret',
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        req.session.userId = user.id;
        req.session.token = token;

        return res.json({
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });
    } catch (err) { next(err); }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ message: 'Logged out successfully.' });
    });
});

// GET /api/auth/me
router.get('/me', async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'unauthorized', message: 'No token provided.' });
        }
        const token = authHeader.slice(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-jwt-secret');
        const user = await prisma.user.findUnique({ where: { id: decoded.id }, select: { id: true, name: true, email: true, role: true } });
        if (!user) return res.status(404).json({ error: 'not_found', message: 'User not found.' });
        res.json({ user });
    } catch (err) {
        if (err.name === 'JsonWebTokenError') return res.status(401).json({ error: 'invalid_token', message: 'Invalid token.' });
        next(err);
    }
});

export default router;
