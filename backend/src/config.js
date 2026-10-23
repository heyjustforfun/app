import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const BACKEND_ROOT = path.resolve(__dirname, '..');
export const REPO_ROOT = path.resolve(BACKEND_ROOT, '..');

// backend/.env first, then the repo root .env (Hostinger runs the app from the repo root).
// Variables set in hPanel always win because dotenv never overrides existing values.
dotenv.config({ path: path.join(BACKEND_ROOT, '.env'), quiet: true });
dotenv.config({ path: path.join(REPO_ROOT, '.env'), quiet: true });

const isProd = process.env.NODE_ENV === 'production';
const defaultSecret = 'a2ed94a5ed6f1b055a049c256c9cae72b608cd11d6e0a6a010d993dd6fceed43';

export const config = {
  isProd,
  port: Number(process.env.PORT) || 4100,
  db: {
    host: process.env.MYSQLHOST || process.env.MYSQL_HOST || process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.MYSQLPORT || process.env.MYSQL_PORT || process.env.DB_PORT) || 3306,
    user: process.env.MYSQLUSER || process.env.MYSQL_USER || process.env.DB_USER || 'root',
    password: process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || process.env.DB_NAME || 'fund_portal',
  },
  jwtSecret: process.env.JWT_SECRET || (isProd ? defaultSecret : 'dev-only-secret-do-not-use-in-production'),
  sessionDays: 7,
  uploadDir: path.resolve(process.env.UPLOAD_DIR || path.join(BACKEND_ROOT, 'uploads')),
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@example.com',
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || '',
  },
  websiteDist: path.join(REPO_ROOT, 'website', 'dist'),
  dashboardDist: path.join(REPO_ROOT, 'dashboard', 'dist'),
};
