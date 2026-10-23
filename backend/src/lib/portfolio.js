import { query } from '../db.js';
import { round2 } from './validate.js';

export async function getHoldings(userId) {
  const rows = await query(
    `SELECT h.fund_id, h.units, h.invested, f.name, f.slug, f.risk_level, f.current_nav
       FROM holdings h JOIN funds f ON f.id = h.fund_id
      WHERE h.user_id = ? AND h.units > 0
      ORDER BY f.sort_order, f.id`,
    [userId],
  );
  return rows.map((r) => {
    const value = round2(r.units * r.current_nav);
    return { ...r, value, pnl: round2(value - r.invested) };
  });
}

const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

/**
 * Daily portfolio value for the last `days` days, rebuilt from the user's
 * subscriptions/redemptions and each fund's published NAV history.
 */
export async function valueHistory(userId, days = 90) {
  const txns = await query(
    "SELECT fund_id, units, nav, created_at FROM transactions WHERE user_id = ? AND type IN ('subscription','redemption') ORDER BY id",
    [userId],
  );
  if (!txns.length) return [];

  const fundIds = [...new Set(txns.map((t) => t.fund_id))];
  const navRows = await query('SELECT fund_id, nav, as_of FROM nav_history WHERE fund_id IN (?) ORDER BY as_of', [fundIds]);
  const navs = Object.fromEntries(fundIds.map((id) => [id, navRows.filter((n) => n.fund_id === id)]));

  const today = new Date();
  const start = new Date(Math.max(new Date(txns[0].created_at).getTime(), today.getTime() - days * 86400000));
  const units = Object.fromEntries(fundIds.map((id) => [id, 0]));
  const lastNav = Object.fromEntries(fundIds.map((id) => [id, null]));
  const navIdx = Object.fromEntries(fundIds.map((id) => [id, 0]));
  let ti = 0;
  const points = [];

  for (let d = new Date(dayKey(start)); d <= today; d = new Date(d.getTime() + 86400000)) {
    const key = dayKey(d);
    while (ti < txns.length && dayKey(txns[ti].created_at) <= key) {
      const t = txns[ti++];
      units[t.fund_id] += Number(t.units);
      if (lastNav[t.fund_id] == null) lastNav[t.fund_id] = Number(t.nav);
    }
    let value = 0;
    for (const id of fundIds) {
      const list = navs[id];
      while (navIdx[id] < list.length && list[navIdx[id]].as_of <= key) lastNav[id] = Number(list[navIdx[id]++].nav);
      value += units[id] * (lastNav[id] ?? 0);
    }
    points.push({ date: key, value: round2(value) });
  }
  return points;
}

/** Returns over standard periods computed from a fund's NAV history (oldest first). */
export function fundPerformance(history, currentNav) {
  if (!history.length) return { since_inception: null, d30: null, y1: null, change_1d: null };
  const navOn = (daysAgo) => {
    const cutoff = dayKey(Date.now() - daysAgo * 86400000);
    let found = null;
    for (const h of history) {
      if (h.as_of <= cutoff) found = h.nav;
      else break;
    }
    return found;
  };
  const pct = (from) => (from ? (currentNav / from - 1) * 100 : null);
  const prev = history.length > 1 ? history[history.length - 2].nav : null;
  return {
    since_inception: pct(history[0].nav),
    d30: pct(navOn(30)),
    y1: pct(navOn(365)),
    change_1d: pct(prev),
    inception_date: history[0].as_of,
  };
}
