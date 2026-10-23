export const BRAND = { name: 'ApexLedger', tag: 'CAPITAL' };
export const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL || '/app';

export async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch', ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const usd = (n, digits = 2) =>
  Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits });

export const compactUsd = (n) =>
  Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });

export const pct = (n, digits = 2) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`);

export const navFmt = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

export const riskLabel = { low: 'Lower risk', medium: 'Medium risk', high: 'Higher risk' };
export const riskColor = {
  low: 'text-sky-300 bg-sky-500/10 border-sky-500/20',
  medium: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  high: 'text-rose-300 bg-rose-500/10 border-rose-500/20',
};
