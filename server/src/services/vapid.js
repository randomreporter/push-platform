import webpush from 'web-push';
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';

function getEncryptionKey() {
    const keyHex = process.env.VAPID_ENCRYPTION_KEY || '0'.repeat(64);
    return Buffer.from(keyHex, 'hex');
}

export function generateVapidKeys() {
    return webpush.generateVAPIDKeys();
}

export function encryptPrivateKey(privateKey) {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(privateKey, 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptPrivateKey(encryptedKey) {
    const key = getEncryptionKey();
    const [ivHex, encryptedHex] = encryptedKey.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

export function getWebPushInstance(site) {
    const privateKey = decryptPrivateKey(site.vapidPrivateKeyEnc);
    webpush.setVapidDetails(
        `mailto:admin@${site.domain}`,
        site.vapidPublicKey,
        privateKey
    );
    return webpush;
}
