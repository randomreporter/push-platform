import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import SQLiteStore from 'connect-sqlite3';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQLiteStoreSession = SQLiteStore(session);

// Routes
import authRouter from './routes/auth.js';
import setupRouter from './routes/setup.js';
import subscribeRouter from './routes/subscribe.js';
import trackRouter from './routes/track.js';
import siteConfigRouter from './routes/siteConfig.js';
import tagsRouter from './routes/tags.js';
import adminSitesRouter from './routes/admin/sites.js';
import adminCampaignsRouter from './routes/admin/campaigns.js';
import adminSubscribersRouter from './routes/admin/subscribers.js';
import adminAnalyticsRouter from './routes/admin/analytics.js';
import adminWebhooksRouter from './routes/admin/webhooks.js';
import adminDashboardRouter from './routes/admin/dashboard.js';

// Middleware
import { requireAuth } from './middleware/auth.js';
import { apiRateLimiter, adminRateLimiter } from './middleware/rateLimiter.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Security & Body Parsing
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Session
app.use(session({
  store: new SQLiteStoreSession({ db: 'sessions.db', dir: path.join(__dirname, '../') }),
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// Request logger (dev)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const color = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
    console.log(`${color}${req.method} ${req.path} → ${res.statusCode} (${ms}ms)\x1b[0m`);
  });
  next();
});

// Serve SDK files — must set Service-Worker-Allowed header so SW can control wider scope
app.use('/sdk', (req, res, next) => {
  if (req.path.endsWith('sw.js')) {
    res.setHeader('Service-Worker-Allowed', '/');
  }
  next();
}, express.static(path.join(__dirname, '../../sdk')));

// Serve Admin SPA in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../admin/dist')));
}

// Setup Wizard (only accessible when APP_INSTALLED !== 'true')
app.use('/api/setup', setupRouter);

// Public API (rate-limited)
app.use('/api/subscribe', apiRateLimiter, subscribeRouter);
app.use('/api/unsubscribe', apiRateLimiter, subscribeRouter);
app.use('/api/track', apiRateLimiter, trackRouter);
app.use('/api/site', apiRateLimiter, siteConfigRouter);
app.use('/api/subscriber/tags', apiRateLimiter, tagsRouter);

// Auth routes
app.use('/api/auth', authRouter);

// Admin API (JWT protected)
app.use('/api/admin', adminRateLimiter, requireAuth, adminDashboardRouter);
app.use('/api/admin/sites', adminRateLimiter, requireAuth, adminSitesRouter);
app.use('/api/admin/campaigns', adminRateLimiter, requireAuth, adminCampaignsRouter);
app.use('/api/admin/subscribers', adminRateLimiter, requireAuth, adminSubscribersRouter);
app.use('/api/admin/analytics', adminRateLimiter, requireAuth, adminAnalyticsRouter);
app.use('/api/admin/webhooks', adminRateLimiter, requireAuth, adminWebhooksRouter);

// SPA fallback in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../admin/dist/index.html'));
  });
}

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', version: '1.1.0' }));

// Global error handler
app.use((err, req, res, _next) => {
  console.error('[ERROR]', err.message);
  const status = err.status || 500;
  res.status(status).json({
    error: err.code || 'internal_error',
    message: err.message || 'An unexpected error occurred.'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
  console.log(`🚀 Push Platform server running on port ${PORT}`);
  console.log(`   URL: ${appUrl}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Installed: ${process.env.APP_INSTALLED}`);
});

export default app;
