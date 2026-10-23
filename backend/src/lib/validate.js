export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const bad = (message) => new HttpError(400, message);
export const notFound = (message = 'Not found') => new HttpError(404, message);

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const round6 = (n) => Math.round((Number(n) + Number.EPSILON) * 1e6) / 1e6;

export function str(value, { name = 'Field', min = 0, max = 255, required = true } = {}) {
  const v = value == null ? '' : String(value).trim();
  if (!v) {
    if (required) throw bad(`${name} is required`);
    return null;
  }
  if (v.length < min) throw bad(`${name} must be at least ${min} characters`);
  if (v.length > max) throw bad(`${name} must be at most ${max} characters`);
  return v;
}

export function email(value) {
  const v = str(value, { name: 'Email', max: 190 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw bad('Enter a valid email address');
  return v;
}

export function username(value) {
  const v = str(value, { name: 'Username', min: 3, max: 30 });
  if (!/^[a-zA-Z0-9_]+$/.test(v)) throw bad('Username can only contain letters, numbers and underscores');
  return v;
}

export function password(value, name = 'Password') {
  const v = value == null ? '' : String(value);
  if (v.length < 8) throw bad(`${name} must be at least 8 characters`);
  if (v.length > 128) throw bad(`${name} is too long`);
  return v;
}

/** Positive money amount rounded to cents. */
export function amount(value, name = 'Amount') {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw bad(`${name} must be a positive number`);
  if (n > 1e12) throw bad(`${name} is too large`);
  return round2(n);
}

export function intId(value, name = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw bad(`Invalid ${name}`);
  return n;
}

export function oneOf(value, allowed, name = 'Value') {
  if (!allowed.includes(value)) throw bad(`${name} must be one of: ${allowed.join(', ')}`);
  return value;
}

export function page(req, defaultSize = 25) {
  const size = Math.min(Math.max(Number(req.query.size) || defaultSize, 1), 200);
  const p = Math.max(Number(req.query.page) || 1, 1);
  return { limit: size, offset: (p - 1) * size, page: p, size };
}
