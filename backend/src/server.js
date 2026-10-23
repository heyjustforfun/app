import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import { config } from './config.js';
import { migrate } from './migrate.js';
import { authenticate, csrfGuard, requireAdmin, requireAuth } from './lib/auth.js';
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import meRoutes from './routes/me.js';
import fundRoutes from './routes/funds.js';
import walletRoutes from './routes/wallet.js';
import inboxRoutes from './routes/inbox.js';
import adminUserRoutes from './routes/admin/users.js';
import adminFinanceRoutes from './routes/admin/finance.js';
import adminDeskRoutes from './routes/admin/desk.js';
import adminTaskRoutes from './routes/admin/tasks.js';
import taskRoutes from './routes/tasks.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'img-src': ["'self'", 'data:', 'blob:'],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());

  // ---- API ----
  const api = express.Router();
  api.use(express.json({ limit: '1mb' }));
  api.use(cookieParser());
  api.use(csrfGuard);
  api.use(authenticate);

  api.get('/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
  api.use('/auth', authRoutes);
  api.use('/public', publicRoutes);
  api.use('/me', requireAuth, meRoutes);
  api.use('/funds', requireAuth, fundRoutes);
  // Wallet and inbox routers sit at the API root; guard only their paths so unknown URLs still 404
  api.use(['/deposits', '/withdrawals', '/support', '/notifications', '/documents'], requireAuth);
  api.use(walletRoutes);
  api.use(inboxRoutes);
  api.use('/admin/users', requireAdmin, adminUserRoutes);
  api.use('/admin/tasks', requireAdmin, adminTaskRoutes);
  api.use('/admin', requireAdmin, adminFinanceRoutes);
  api.use('/admin', requireAdmin, adminDeskRoutes);
  api.use('/tasks', requireAuth, taskRoutes);
  api.use((_req, res) => res.status(404).json({ error: 'Endpoint not found' }));

  api.use((err, _req, res, _next) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 8 MB)' : err.message });
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'That record already exists' });
    if (err.code === 'ECONNREFUSED' || err.code === 'ER_ACCESS_DENIED_ERROR' || err.code === 'ER_BAD_DB_ERROR' || err.code === 'ENOTFOUND') {
      return res.status(503).json({ error: 'Database is not connected. Please configure your MySQL database credentials in the Render Environment tab.' });
    }
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong. Please try again.' : err.message });
  });
  app.use('/api', api);

  // ---- Frontends ----
  // Dashboard (customer + admin portal) at /app, marketing website at /
  const dashboardIndex = path.join(config.dashboardDist, 'index.html');
  const websiteIndex = path.join(config.websiteDist, 'index.html');
  const assetCache = { maxAge: '30d', immutable: true };

  // Explicit redirects for portal URLs accessed from the root
  const portalRedirectPaths = [
    '/login',
    '/register',
    '/admin',
    '/tasks',
    '/packages',
    '/funds',
    '/deposit',
    '/withdraw',
    '/referrals',
    '/support',
    '/profile',
  ];
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (portalRedirectPaths.includes(req.path) || req.path.startsWith('/admin/')) {
      return res.redirect(302, `/app${req.originalUrl}`);
    }
    next();
  });

  app.use('/app/assets', express.static(path.join(config.dashboardDist, 'assets'), assetCache));
  app.use('/app', express.static(config.dashboardDist, { index: false }));
  app.use('/app', (req, res, next) => {
    if (req.method !== 'GET' || !fs.existsSync(dashboardIndex)) return next();
    res.set('Cache-Control', 'no-cache').sendFile(dashboardIndex);
  });

  app.use('/assets', express.static(path.join(config.websiteDist, 'assets'), assetCache));
  app.use(express.static(config.websiteDist, { index: false }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || !fs.existsSync(websiteIndex)) return next();
    res.set('Cache-Control', 'no-cache').sendFile(websiteIndex);
  });

  app.use((_req, res) => res.status(404).send('Not found. Run "npm run build" to build the website and dashboard.'));
  return app;
}

async function start() {
  const app = createApp();
  const server = app.listen(config.port, (err) => {
    if (err) {
      console.error(`[server] Could not listen on port ${config.port}: ${err.message}`);
      process.exit(1);
    }
    console.log(`[server] Listening on http://localhost:${config.port} (${config.isProd ? 'production' : 'development'})`);
  });

  try {
    await migrate();
    console.log('[server] Database migrated and ready');
  } catch (err) {
    console.error('[server] Database migration notice:', err.message);
    if (err.code === 'ECONNREFUSED' || err.code === 'ER_ACCESS_DENIED_ERROR' || err.code === 'ER_BAD_DB_ERROR') {
      console.warn('[server] Ensure DB_HOST, DB_USER, DB_PASSWORD, DB_NAME or MYSQL_URL are set in your environment variables.');
    }
  }
}

start().catch((err) => {
  console.error('[server] Unexpected startup error:', err.message);
  process.exit(1);
});
