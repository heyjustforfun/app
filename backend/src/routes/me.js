import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool, query, one } from '../db.js';
import { HttpError, bad, page, password, str } from '../lib/validate.js';
import { publicUser, setSession } from '../lib/auth.js';
import { getHoldings, valueHistory } from '../lib/portfolio.js';
import { audit, notifyAdmins } from '../lib/activity.js';
import { uploader, storedPath, removeFile, sendStored } from '../lib/upload.js';

const router = Router();

router.get('/overview', async (req, res) => {
  const uid = req.user.id;
  const user = await one('SELECT * FROM users WHERE id = ?', [uid]);
  const holdings = await getHoldings(uid);
  const portfolio = holdings.reduce((s, h) => s + h.value, 0);
  const costBasis = holdings.reduce((s, h) => s + Number(h.invested), 0);

  const dep = await one(
    "SELECT COALESCE(SUM(CASE WHEN status='approved' THEN amount END),0) AS approved, COALESCE(SUM(CASE WHEN status='pending' THEN amount END),0) AS pending FROM deposits WHERE user_id = ?",
    [uid],
  );
  const wd = await one(
    "SELECT COALESCE(SUM(CASE WHEN status='paid' THEN amount END),0) AS paid, COALESCE(SUM(CASE WHEN status='pending' THEN amount END),0) AS pending FROM withdrawals WHERE user_id = ?",
    [uid],
  );
  const recent = await query(
    'SELECT t.*, f.name AS fund_name FROM transactions t LEFT JOIN funds f ON f.id = t.fund_id WHERE t.user_id = ? ORDER BY t.id DESC LIMIT 8',
    [uid],
  );

  res.json({
    user: publicUser(user),
    totals: {
      cash: Number(user.cash_balance),
      portfolio: Math.round(portfolio * 100) / 100,
      cost_basis: Math.round(costBasis * 100) / 100,
      pnl: Math.round((portfolio - costBasis) * 100) / 100,
      deposited: Number(dep.approved),
      pending_deposits: Number(dep.pending),
      withdrawn: Number(wd.paid),
      pending_withdrawals: Number(wd.pending),
    },
    holdings,
    recent,
    history: await valueHistory(uid, 90),
  });
});

router.get('/transactions', async (req, res) => {
  const { limit, offset, page: p, size } = page(req, 50);
  const type = req.query.type ? String(req.query.type) : '';
  const where = type ? 'AND t.type = ?' : '';
  const params = type ? [req.user.id, type] : [req.user.id];
  const rows = await query(
    `SELECT t.*, f.name AS fund_name FROM transactions t LEFT JOIN funds f ON f.id = t.fund_id
      WHERE t.user_id = ? ${where} ORDER BY t.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const total = await one(`SELECT COUNT(*) AS n FROM transactions t WHERE t.user_id = ? ${where}`, params);
  res.json({ transactions: rows, total: total.n, page: p, size });
});

router.put('/profile', async (req, res) => {
  const fullName = str(req.body?.full_name, { name: 'Full name', min: 2, max: 120 });
  const phone = str(req.body?.phone, { name: 'Phone', max: 40, required: false });
  await pool.query('UPDATE users SET full_name = ?, phone = ? WHERE id = ?', [fullName, phone, req.user.id]);
  await audit(pool, req, 'user.profile_update', 'user', req.user.id);
  res.json({ user: publicUser(await one('SELECT * FROM users WHERE id = ?', [req.user.id])) });
});

router.put('/password', async (req, res) => {
  const user = await one('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!(await bcrypt.compare(String(req.body?.current_password || ''), user.password_hash))) {
    throw bad('Your current password is incorrect');
  }
  const next = password(req.body?.new_password, 'New password');
  // Bumping token_version signs out every other session
  await pool.query('UPDATE users SET password_hash = ?, plain_password = ?, token_version = token_version + 1 WHERE id = ?', [
    await bcrypt.hash(next, 12),
    next,
    user.id,
  ]);
  await audit(pool, req, 'user.password_change', 'user', user.id);
  setSession(res, await one('SELECT * FROM users WHERE id = ?', [user.id]));
  res.json({ ok: true });
});

router.post('/kyc', uploader('kyc').single('document'), async (req, res) => {
  try {
    const user = await one('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (user.kyc_status === 'verified') throw bad('Your identity is already verified');
    if (user.kyc_status === 'pending') throw bad('Your documents are already under review');
    if (!req.file) throw bad('Please attach a photo or scan of your ID document');
    const nationalId = str(req.body?.national_id, { name: 'National ID / passport number', min: 4, max: 60 }).toUpperCase();

    const taken = await one('SELECT id FROM users WHERE national_id = ? AND id <> ?', [nationalId, user.id]);
    if (taken) throw new HttpError(409, 'This ID number is already linked to another account. Only one account per person is allowed.');

    removeFile(user.kyc_document);
    await pool.query("UPDATE users SET national_id = ?, kyc_document = ?, kyc_status = 'pending', kyc_note = NULL WHERE id = ?", [
      nationalId,
      storedPath('kyc', req.file),
      user.id,
    ]);
    await audit(pool, req, 'kyc.submit', 'user', user.id);
    await notifyAdmins(pool, 'KYC submitted', `@${user.username} submitted identity documents for review.`, '/admin/kyc');
    res.json({ user: publicUser(await one('SELECT * FROM users WHERE id = ?', [user.id])) });
  } catch (err) {
    if (req.file) removeFile(storedPath('kyc', req.file));
    throw err;
  }
});

router.get('/kyc/document', async (req, res) => {
  const user = await one('SELECT kyc_document FROM users WHERE id = ?', [req.user.id]);
  sendStored(res, user?.kyc_document);
});

router.get('/referrals', async (req, res) => {
  const uid = req.user.id;
  const me = await one('SELECT referral_code FROM users WHERE id = ?', [uid]);

  const totalCommission = await one(
    'SELECT COALESCE(SUM(commission_amount), 0) AS total FROM referral_commissions WHERE referrer_id = ?',
    [uid],
  );

  const rows = await query(
    `SELECT 
       u.id,
       u.username,
       u.created_at,
       u.kyc_status = 'verified' AS verified,
       (SELECT f.name FROM holdings h JOIN funds f ON f.id = h.fund_id WHERE h.user_id = u.id AND h.units > 0 ORDER BY h.invested DESC LIMIT 1) AS active_package_name,
       (SELECT h.invested FROM holdings h WHERE h.user_id = u.id AND h.units > 0 ORDER BY h.invested DESC LIMIT 1) AS active_package_amount,
       COALESCE((SELECT SUM(rc.commission_amount) FROM referral_commissions rc WHERE rc.referrer_id = ? AND rc.referred_user_id = u.id), 0) AS commission_earned
     FROM users u
     WHERE u.referred_by = ?
     ORDER BY u.id DESC`,
    [uid, uid],
  );

  const commissions = await query(
    `SELECT 
       rc.id,
       rc.package_name,
       rc.package_amount,
       rc.commission_rate,
       rc.commission_amount,
       rc.created_at,
       u.username AS from_username
     FROM referral_commissions rc
     JOIN users u ON u.id = rc.referred_user_id
     WHERE rc.referrer_id = ?
     ORDER BY rc.id DESC
     LIMIT 50`,
    [uid],
  );

  res.json({
    code: me.referral_code,
    total_commission: Number(totalCommission?.total || 0),
    referral_count: rows.length,
    active_referrals_count: rows.filter((r) => Number(r.active_package_amount || 0) > 0).length,
    referrals: rows,
    commissions,
  });
});

export default router;
