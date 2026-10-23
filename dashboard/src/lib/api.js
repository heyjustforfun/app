export const BRAND = { name: 'ApexLedger', tag: 'CAPITAL' };
export const WEBSITE_URL = import.meta.env.VITE_WEBSITE_URL || '/';

async function handle(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return handle(res);
}

/** POST multipart/form-data (file uploads). `fields` is a plain object; File values are appended as files. */
export async function upload(path, fields) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null && v !== '') fd.append(k, v);
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-Requested-With': 'fetch' },
    body: fd,
  });
  return handle(res);
}

export const usd = (n, digits = 2) =>
  Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits });

export const signedUsd = (n) => `${Number(n) > 0 ? '+' : Number(n) < 0 ? '−' : ''}${usd(Math.abs(Number(n)))}`;

export const pct = (n, digits = 2) => (n == null || Number.isNaN(n) ? '—' : `${n >= 0 ? '+' : ''}${Number(n).toFixed(digits)}%`);

export const units = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });

export const navFmt = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

// Date-only strings (YYYY-MM-DD) are calendar dates, so parse them as local time, not UTC
const toDate = (d) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00`) : new Date(d));

export const date = (d) => (d ? toDate(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

export const dateTime = (d) =>
  d ? new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export const timeAgo = (d) => {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export const fileSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export const TX_LABELS = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  withdrawal_reversal: 'Withdrawal returned',
  subscription: 'Investment',
  redemption: 'Redemption',
  adjustment: 'Adjustment',
};

export const RISK = {
  low: { label: 'Lower risk', cls: 'text-sky-300 bg-sky-500/10 border-sky-500/20' },
  medium: { label: 'Medium risk', cls: 'text-amber-300 bg-amber-500/10 border-amber-500/20' },
  high: { label: 'Higher risk', cls: 'text-rose-300 bg-rose-500/10 border-rose-500/20' },
};
