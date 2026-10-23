import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { pool, query, one } from '../db.js';
import { getSettings } from '../migrate.js';
import { email, str } from '../lib/validate.js';
import { fundPerformance } from '../lib/portfolio.js';
import { getMarket } from '../lib/market.js';
import { notifyAdmins } from '../lib/activity.js';

const router = Router();

export async function fundsWithPerformance({ includeClosed = false } = {}) {
  const funds = await query(
    `SELECT id, name, slug, tagline, description, strategy, risk_level, min_investment, management_fee_pct, current_nav, status, sort_order
       FROM funds ${includeClosed ? '' : "WHERE status = 'open'"} ORDER BY sort_order, id`,
  );
  if (!funds.length) return [];
  const navs = await query(
    'SELECT fund_id, nav, as_of FROM nav_history WHERE fund_id IN (?) AND as_of >= DATE_SUB(CURDATE(), INTERVAL 400 DAY) ORDER BY as_of',
    [funds.map((f) => f.id)],
  );
  const firsts = await query(
    `SELECT n.fund_id, n.nav, n.as_of FROM nav_history n
       JOIN (SELECT fund_id, MIN(as_of) AS m FROM nav_history WHERE fund_id IN (?) GROUP BY fund_id) x
         ON x.fund_id = n.fund_id AND x.m = n.as_of`,
    [funds.map((f) => f.id)],
  );
  return funds.map((f) => {
    const history = navs.filter((n) => n.fund_id === f.id).map(({ nav, as_of }) => ({ nav, as_of }));
    const first = firsts.find((x) => x.fund_id === f.id);
    // Make sure since-inception uses the very first NAV even if it is older than the 400-day window
    const full = first && history.length && first.as_of < history[0].as_of ? [{ nav: first.nav, as_of: first.as_of }, ...history] : history;
    return { ...f, performance: fundPerformance(full, f.current_nav), history: history.slice(-365) };
  });
}

router.get('/funds', async (_req, res) => {
  res.json({ funds: await fundsWithPerformance() });
});

router.get('/stats', async (_req, res) => {
  const members = await one("SELECT COUNT(*) AS n FROM users WHERE role = 'customer'");
  const aum = await one('SELECT COALESCE(SUM(h.units * f.current_nav), 0) AS v FROM holdings h JOIN funds f ON f.id = h.fund_id');
  const funds = await one("SELECT COUNT(*) AS n FROM funds WHERE status = 'open'");
  res.json({ members: members.n, aum: Math.round(Number(aum.v) * 100) / 100, funds: funds.n });
});

router.get('/settings', async (_req, res) => {
  res.json({
    settings: await getSettings(['company_name', 'support_email', 'support_phone', 'office_address', 'regulatory_notice']),
  });
});

router.get('/market', async (_req, res) => {
  res.json({ market: await getMarket() });
});

const inquiryLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });

router.post('/inquiries', inquiryLimiter, async (req, res) => {
  const b = req.body || {};
  const name = str(b.name, { name: 'Name', min: 2, max: 120 });
  const mail = email(b.email);
  const topic = str(b.topic, { name: 'Topic', max: 80 });
  const message = str(b.message, { name: 'Message', min: 10, max: 5000 });
  await pool.query('INSERT INTO inquiries (name, email, topic, message) VALUES (?, ?, ?, ?)', [name, mail, topic, message]);
  await notifyAdmins(pool, 'New website inquiry', `${name} (${mail}) — ${topic}`, '/admin/inquiries');
  res.status(201).json({ ok: true });
});

export default router;
