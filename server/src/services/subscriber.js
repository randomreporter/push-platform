import crypto from 'crypto';
import geoip from 'geoip-lite';
import UAParser from 'ua-parser-js';

export function hashEndpoint(endpoint) {
    return crypto.createHash('sha256').update(endpoint).digest('hex');
}

export function detectBrowser(userAgent) {
    if (!userAgent) return null;
    const parser = new UAParser(userAgent);
    return parser.getBrowser().name || null;
}

export function detectOS(userAgent) {
    if (!userAgent) return null;
    const parser = new UAParser(userAgent);
    return parser.getOS().name || null;
}

export function detectCountry(ip) {
    if (!ip || process.env.GEOIP_DRIVER === 'disabled') return null;
    try {
        const geo = geoip.lookup(ip);
        return geo?.country || null;
    } catch {
        return null;
    }
}

export function getClientIp(req) {
    return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
}
