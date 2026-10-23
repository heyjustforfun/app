// LOCAL DEVELOPMENT ONLY: fills the database with sample NAV history and a demo customer
// so you can click through the dashboards. Never run this against your live database:
// the NAV numbers are random and would be shown to real investors as performance.
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { pool, one, query, tx } from './db.js';
import { migrate, newReferralCode } from './migrate.js';
import { postCash } from './lib/ledger.js';
import { round6 } from './lib/validate.js';

if (config.isProd) {
  console.error('Refusing to seed demo data in production.');
  process.exit(1);
}

await migrate();

const funds = await query('SELECT id, risk_level FROM funds');
const vol = { low: 0.0008, medium: 0.004, high: 0.009 };
const drift = { low: 0.00012, medium: 0.00025, high: 0.0004 };

for (const f of funds) {
  const existing = await one('SELECT COUNT(*) AS n FROM nav_history WHERE fund_id = ?', [f.id]);
  if (existing.n > 5) continue;
  await pool.query('DELETE FROM nav_history WHERE fund_id = ?', [f.id]);
  let nav = 1;
  for (let i = 400; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    nav = round6(nav * (1 + drift[f.risk_level] + (Math.random() - 0.5) * 2 * vol[f.risk_level]));
    await pool.query("INSERT INTO nav_history (fund_id, nav, as_of, note) VALUES (?, ?, ?, 'Demo data')", [f.id, nav, d.toISOString().slice(0, 10)]);
  }
  await pool.query('UPDATE funds SET current_nav = ? WHERE id = ?', [nav, f.id]);
}

if (!(await one("SELECT id FROM users WHERE username = 'demo_user'"))) {
  const [r] = await pool.query(
    "INSERT INTO users (username, email, phone, full_name, password_hash, referral_code) VALUES ('demo_user', 'demo@example.com', '+1 555 0100', 'Demo Investor', ?, ?)",
    [await bcrypt.hash('demo12345', 12), await newReferralCode()],
  );
  const uid = r.insertId;
  await tx(async (conn) => {
    await conn.query("INSERT INTO deposits (user_id, amount, method, reference, status, reviewed_at) VALUES (?, 5000, 'Bank wire', 'DEMO-001', 'approved', NOW())", [uid]);
    await postCash(conn, uid, 5000, { type: 'deposit', referenceId: 1, description: 'Deposit via Bank wire (demo)' });
    const [[fund]] = await conn.query('SELECT * FROM funds ORDER BY sort_order LIMIT 1 OFFSET 1');
    const navRow = (await conn.query('SELECT nav FROM nav_history WHERE fund_id = ? AND as_of <= DATE_SUB(CURDATE(), INTERVAL 60 DAY) ORDER BY as_of DESC LIMIT 1', [fund.id]))[0][0];
    const nav = Number(navRow?.nav ?? fund.current_nav);
    const units = round6(3000 / nav);
    await postCash(conn, uid, -3000, { type: 'subscription', fundId: fund.id, units, nav, description: `Invested in ${fund.name} (demo)` });
    await conn.query('UPDATE transactions SET created_at = DATE_SUB(NOW(), INTERVAL 60 DAY) WHERE user_id = ?', [uid]);
    await conn.query('INSERT INTO holdings (user_id, fund_id, units, invested) VALUES (?, ?, ?, 3000)', [uid, fund.id, units]);
  });
  await pool.query("INSERT INTO deposits (user_id, amount, method, reference) VALUES (?, 1000, 'Bank wire', 'DEMO-002')", [uid]);
  await pool.query("INSERT INTO messages (user_id, sender_id, is_staff, body) VALUES (?, ?, 0, 'Hi, when will my second deposit be approved?')", [uid, uid]);
  console.log('Demo customer created  →  login: demo_user / demo12345');
}

console.log('Demo data ready.');
await pool.end();
