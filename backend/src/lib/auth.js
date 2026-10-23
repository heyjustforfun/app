import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { one } from '../db.js';

export function setSession(res, user) {
  const token = jwt.sign({ sub: user.id, v: user.token_version }, config.jwtSecret, {
    expiresIn: '24h',
  });
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    path: '/',
  });
}

export function clearSession(res) {
  res.clearCookie('token', { path: '/' });
}

export function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    phone: u.phone,
    full_name: u.full_name,
    role: u.role,
    status: u.status,
    cash_balance: Number(u.cash_balance),
    kyc_status: u.kyc_status,
    kyc_note: u.kyc_note,
    national_id: u.national_id,
    referral_code: u.referral_code,
    created_at: u.created_at,
    last_login_at: u.last_login_at,
  };
}

/** Attaches req.user when a valid session cookie is present. */
export async function authenticate(req, _res, next) {
  const token = req.cookies?.token;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const u = await one('SELECT id, username, email, role, status, token_version FROM users WHERE id = ?', [payload.sub]);
    if (u && u.status === 'active' && u.token_version === payload.v) req.user = u;
  } catch {
    // invalid or expired token: treat as signed out
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please sign in to continue' });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please sign in to continue' });
  if (req.user.role !== 'admin' && req.user.role !== 'agent') return res.status(403).json({ error: 'Administrator or Agent access required' });
  next();
}

/** Blocks cross-site form posts: browsers can't add custom headers to those. */
export function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('x-requested-with') !== 'fetch') return res.status(403).json({ error: 'Invalid request origin' });
  next();
}
