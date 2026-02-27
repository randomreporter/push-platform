/**
 * PushPlatform Service Worker  v1.1
 * Handles push events, notification click/close, and click tracking.
 * Registered by push-sdk.js; must be served from the root scope.
 */

const CLICK_TRACK_HEADER = 'X-PushPlatform-SW';

// ─── Push Event ─────────────────────────────────────────────────────────────
self.addEventListener('push', function (event) {
    if (!event.data) return;

    let payload;
    try {
        payload = event.data.json();
    } catch {
        payload = { title: 'Notification', body: event.data.text(), data: {} };
    }

    const {
        title = 'Notification',
        body = '',
        icon,
        badge,
        image,
        data = {}
    } = payload;

    const options = {
        body,
        icon: icon || undefined,
        badge: badge || undefined,
        image: image || undefined,
        data,
        requireInteraction: false,
        vibrate: [150, 75, 150],
        tag: `pp-${data.campaign_id || 'general'}`,
        renotify: true,
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// ─── Notification Click ──────────────────────────────────────────────────────
self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    const { url, campaign_id, subscriber_id, click_tracking_url } = event.notification.data || {};

    event.waitUntil((async () => {
        // Track click (fire-and-forget)
        if (click_tracking_url && campaign_id) {
            try {
                await fetch(click_tracking_url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', [CLICK_TRACK_HEADER]: '1' },
                    body: JSON.stringify({ campaign_id, subscriber_id }),
                    keepalive: true,
                });
            } catch { /* non-critical */ }
        }

        // Open target URL
        if (url) {
            let finalUrl = url;
            if (!url.startsWith('http')) {
                finalUrl = 'https://' + url;
            }
            const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
            const existing = allClients.find(c => c.url === finalUrl && 'focus' in c);
            if (existing) {
                await existing.focus();
            } else {
                await clients.openWindow(finalUrl);
            }
        }
    })());
});

// ─── Notification Close ──────────────────────────────────────────────────────
self.addEventListener('notificationclose', function (event) {
    const { campaign_id, subscriber_id } = event.notification.data || {};
    if (!campaign_id) return;

    // Best-effort dismissal tracking via sendBeacon
    const apiBase = self.registration.scope.replace(/\/$/, '');
    const body = JSON.stringify({ campaign_id, subscriber_id });
    try {
        navigator.sendBeacon
            ? navigator.sendBeacon(`${apiBase}/api/track/dismiss`, new Blob([body], { type: 'application/json' }))
            : fetch(`${apiBase}/api/track/dismiss`, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true });
    } catch { /* non-critical */ }
});

// ─── Install / Activate ──────────────────────────────────────────────────────
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});
