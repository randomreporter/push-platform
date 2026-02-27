import rateLimit from 'express-rate-limit';

const makeStore = () => {
    // Use memory store (works without Redis for dev)
    return undefined; // uses MemoryStore by default
};

export const apiRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    store: makeStore(),
    handler: (req, res) => {
        const resetSec = Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000);
        res.status(429).json({
            error: 'too_many_requests',
            message: `Rate limit exceeded. Please retry after ${resetSec} seconds.`,
            retry_after: resetSec
        });
    }
});

export const subscribeRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    store: makeStore(),
    handler: (req, res) => {
        res.status(429).json({ error: 'too_many_requests', message: 'Too many subscription attempts.' });
    }
});

export const adminRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    store: makeStore(),
    keyGenerator: (req) => req.session?.userId?.toString() || req.ip,
    handler: (req, res) => {
        res.status(429).json({ error: 'too_many_requests', message: 'Admin rate limit exceeded.' });
    }
});

export const trackRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    store: makeStore(),
});
