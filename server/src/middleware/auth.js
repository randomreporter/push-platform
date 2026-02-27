import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'unauthorized', message: 'Authentication required.' });
    }
    try {
        const token = authHeader.slice(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-jwt-secret');
        req.user = decoded;
        next();
    } catch {
        return res.status(401).json({ error: 'invalid_token', message: 'Invalid or expired token.' });
    }
}
