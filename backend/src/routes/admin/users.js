import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool, query, one, tx } from '../../db.js';
import { newReferralCode } from '../../migrate.js';
import { HttpError, bad, email, intId, oneOf, page, password, round2, round6, str, username } from '../../lib/validate.js';
import { postCash } from '../../lib/ledger.js';
import { audit, notify } from '../../lib/activity.js';
import { creditReferralCommission } from '../../lib/referral.js';
import { getHoldings } from '../../lib/portfolio.js';
import { publicUser } from '../../lib/auth.js';
import { sendStored } from '../../lib/upload.js';

const router = Router();
const money = (n) => `$${Math.abs(Number(n)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const USER_COLUMNS = `u.id, u.username, u.email, u.phone, u.full_name, u.role, u.status, u.cash_balance, u.kyc_status,
  u.plain_password,
  u.national_id, u.kyc_note, u.kyc_document IS NOT NULL AS has_kyc_document, u.referral_code, u.created_at, u.last_login_at,
  TIMESTAMPDIFF(MINUTE, u.last_login_at, NOW()) AS minutes_since_login,
  (u.last_login_at IS NOT NULL AND TIMESTAMPDIFF(MINUTE, u.last_login_at, NOW()) <= 15) AS is_online,
  COALESCE((SELECT SUM(h.units * f.current_nav) FROM holdings h JOIN funds f ON f.id = h.fund_id WHERE h.user_id = u.id), 0) AS portfolio_value,
  (SELECT f.name FROM holdings h JOIN funds f ON f.id = h.fund_id WHERE h.user_id = u.id AND h.units > 0 ORDER BY h.units * f.current_nav DESC LIMIT 1) AS active_package_name,
  (SELECT f.id FROM holdings h JOIN funds f ON f.id = h.fund_id WHERE h.user_id = u.id AND h.units > 0 ORDER BY h.units * f.current_nav DESC LIMIT 1) AS active_package_fund_id,
  (SELECT f.min_investment FROM holdings h JOIN funds f ON f.id = h.fund_id WHERE h.user_id = u.id AND h.units > 0 ORDER BY h.units * f.current_nav DESC LIMIT 1) AS active_package_amount,
  (SELECT h.invested FROM holdings h JOIN funds f ON f.id = h.fund_id WHERE h.user_id = u.id AND h.units > 0 ORDER BY h.units * f.current_nav DESC LIMIT 1) AS active_package_invested,
  (SELECT COUNT(*) FROM user_task_submissions s WHERE s.user_id = u.id AND s.status = 'approved' AND DATE(s.reviewed_at) = CURDATE()) AS tasks_completed_today`;

router.get('/', async (req, res) => {
  const { limit, offset, page: p, size } = page(req, 50);
  const q = String(req.query.q || '').trim();
  const tab = String(req.query.tab || 'all').trim();
  const filters = [];
  const params = [];

  if (q) {
    filters.push('(u.username LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR u.full_name LIKE ? OR u.national_id LIKE ? OR u.id = ?)');
    const like = `%${q}%`;
    params.push(like, like, like, like, like, Number(q.replace(/^#/, '')) || 0);
  }

  if (tab === 'online') {
    filters.push('u.last_login_at IS NOT NULL AND TIMESTAMPDIFF(MINUTE, u.last_login_at, NOW()) <= 60');
  } else if (tab === 'active') {
    filters.push("u.status = 'active'");
  } else if (tab === 'suspended') {
    filters.push("u.status = 'suspended'");
  } else if (tab === 'invested') {
    filters.push('EXISTS (SELECT 1 FROM holdings h WHERE h.user_id = u.id AND h.units > 0)');
  } else if (tab === 'kyc') {
    filters.push("u.kyc_status = 'pending'");
  }

  if (req.query.kyc) {
    filters.push('u.kyc_status = ?');
    params.push(String(req.query.kyc));
  }

  const sort = req.query.sort || 'recent_activity';
  let orderSql = 'ORDER BY COALESCE(u.last_login_at, u.created_at) DESC, u.id DESC';
  if (sort === 'id_desc') orderSql = 'ORDER BY u.id DESC';
  else if (sort === 'cash_desc') orderSql = 'ORDER BY u.cash_balance DESC';
  else if (sort === 'invested_desc') orderSql = 'ORDER BY portfolio_value DESC';
  else if (sort === 'username_asc') orderSql = 'ORDER BY u.username ASC';

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const users = await query(`SELECT ${USER_COLUMNS} FROM users u ${where} ${orderSql} LIMIT ? OFFSET ?`, [...params, limit, offset]);
  const total = await one(`SELECT COUNT(*) AS n FROM users u ${where}`, params);
  res.json({ users, total: total.n, page: p, size });
});

router.get('/:id', async (req, res) => {
  const id = intId(req.params.id, 'user');
  const user = await one(`SELECT ${USER_COLUMNS} FROM users u WHERE u.id = ?`, [id]);
  if (!user) throw new HttpError(404, 'User not found');
  res.json({
    user,
    holdings: await getHoldings(id),
    transactions: await query(
      'SELECT t.*, f.name AS fund_name FROM transactions t LEFT JOIN funds f ON f.id = t.fund_id WHERE t.user_id = ? ORDER BY t.id DESC LIMIT 100',
      [id],
    ),
    deposits: await query('SELECT * FROM deposits WHERE user_id = ? ORDER BY id DESC LIMIT 50', [id]),
    withdrawals: await query('SELECT * FROM withdrawals WHERE user_id = ? ORDER BY id DESC LIMIT 50', [id]),
    referrals: await query('SELECT id, username, created_at FROM users WHERE referred_by = ? ORDER BY id DESC', [id]),
    funds: await query('SELECT id, name, slug, min_investment, current_nav, risk_level, status FROM funds WHERE status = "open" ORDER BY sort_order, min_investment ASC'),
    tasks: await query(
      `SELECT s.id, s.task_id, s.status, s.reward_paid, s.created_at, s.reviewed_at, s.admin_note,
              t.task_code, t.title, t.task_slot, t.reward_pct, t.target_package
         FROM user_task_submissions s
         JOIN daily_tasks t ON t.id = s.task_id
        WHERE s.user_id = ?
        ORDER BY s.id DESC LIMIT 50`,
      [id],
    ),
  });
});

/**
 * Chronological activity feed for one user: their own actions, staff actions on their
 * account / deposits / withdrawals, and support chat messages. Paginate with ?before=<ISO time>.
 */
router.get('/:id/activity', async (req, res) => {
  const id = intId(req.params.id, 'user');
  if (!(await one('SELECT id FROM users WHERE id = ?', [id]))) throw new HttpError(404, 'User not found');
  const limit = Math.min(Math.max(Number(req.query.limit) || 60, 1), 200);
  const before = req.query.before ? new Date(String(req.query.before)) : null;
  if (before && Number.isNaN(before.getTime())) throw bad('Invalid "before" timestamp');
  // <= so events sharing the boundary second aren't skipped; the client drops the duplicates
  const beforeSql = before ? 'AND a.created_at <= ?' : '';
  const beforeArgs = before ? [before] : [];

  const audits = await query(
    `SELECT a.id, a.actor_id, a.action, a.entity, a.entity_id, a.details, a.ip, a.created_at,
            u.username AS actor, u.role AS actor_role, f.name AS fund_name
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.actor_id
       LEFT JOIN funds f ON a.entity = 'fund' AND f.id = a.entity_id
      WHERE (a.actor_id = ?
          OR (a.entity = 'user' AND a.entity_id = ?)
          OR (a.entity = 'deposit' AND a.entity_id IN (SELECT id FROM deposits WHERE user_id = ?))
          OR (a.entity = 'withdrawal' AND a.entity_id IN (SELECT id FROM withdrawals WHERE user_id = ?)))
        ${beforeSql}
      ORDER BY a.created_at DESC, a.id DESC LIMIT ?`,
    [id, id, id, id, ...beforeArgs, limit],
  );
  const messages = await query(
    `SELECT m.id, m.is_staff, m.body, m.attachment_name, m.attachment_path, m.attachment_type, m.created_at, s.username AS sender
       FROM messages m JOIN users s ON s.id = m.sender_id
      WHERE m.user_id = ? ${before ? 'AND m.created_at <= ?' : ''}
      ORDER BY m.created_at DESC, m.id DESC LIMIT ?`,
    [id, ...beforeArgs, limit],
  );

  const events = [
    ...audits.map((a) => {
      let details = null;
      try {
        details = a.details ? JSON.parse(a.details) : null;
      } catch {
        details = { raw: a.details };
      }
      return {
        key: `a${a.id}`,
        kind: 'audit',
        action: a.action,
        entity: a.entity,
        entity_id: a.entity_id,
        fund_name: a.fund_name,
        details,
        ip: a.ip,
        // Staff action = done by someone other than this user (system events have no actor)
        by_staff: a.actor_id != null && a.actor_id !== id,
        actor: a.actor,
        created_at: a.created_at,
      };
    }),
    ...messages.map((m) => ({
      key: `m${m.id}`,
      kind: 'message',
      action: m.is_staff ? 'support.staff_reply' : 'support.message',
      details: { body: m.body.slice(0, 300) },
      by_staff: !!m.is_staff,
      actor: m.sender,
      created_at: m.created_at,
    })),
  ]
    .sort((x, y) => new Date(y.created_at) - new Date(x.created_at))
    .slice(0, limit);

  // Summary is computed over all history, not just this page
  const summary = await one(
    `SELECT
       (SELECT last_login_at FROM users WHERE id = ?) AS last_login_at,
       (SELECT MAX(created_at) FROM audit_log WHERE actor_id = ?) AS last_action_at,
       (SELECT ip FROM audit_log WHERE action = 'user.login' AND actor_id = ? ORDER BY id DESC LIMIT 1) AS last_ip,
       (SELECT COUNT(*) FROM audit_log WHERE action = 'user.login' AND actor_id = ? AND created_at >= NOW() - INTERVAL 30 DAY) AS logins_30d,
       (SELECT COUNT(*) FROM audit_log WHERE action = 'user.login_failed' AND entity_id = ? AND created_at >= NOW() - INTERVAL 30 DAY) AS failed_30d,
       (SELECT COUNT(DISTINCT ip) FROM audit_log WHERE action = 'user.login' AND actor_id = ?) AS distinct_ips`,
    [id, id, id, id, id, id],
  );

  // Other accounts that signed in from any IP this user signed in from (one person, one account check)
  const sharedIp = await query(
    `SELECT u.id, u.username, u.status, COUNT(DISTINCT o.ip) AS shared_ips, MAX(o.created_at) AS last_seen
       FROM audit_log o JOIN users u ON u.id = o.actor_id
      WHERE o.action = 'user.login' AND o.actor_id <> ? AND u.role = 'customer'
        AND o.ip IN (SELECT DISTINCT ip FROM audit_log WHERE action = 'user.login' AND actor_id = ? AND ip IS NOT NULL)
      GROUP BY u.id, u.username, u.status
      ORDER BY last_seen DESC LIMIT 20`,
    [id, id],
  );

  res.json({
    events,
    has_more: audits.length === limit || messages.length === limit,
    summary: {
      ...summary,
      last_seen_at: [summary.last_login_at, summary.last_action_at].filter(Boolean).sort((x, y) => new Date(y) - new Date(x))[0] || null,
    },
    shared_ip_accounts: sharedIp,
  });
});

router.post('/', async (req, res) => {
  const b = req.body || {};
  const uname = username(b.username);
  const mail = email(b.email);
  const role = oneOf(b.role || 'customer', ['customer', 'admin', 'agent'], 'Role');
  if (await one('SELECT id FROM users WHERE email = ? OR username = ?', [mail, uname])) {
    throw new HttpError(409, 'An account with that email or username already exists');
  }
  const rawPwd = password(b.password);
  const [r] = await pool.query(
    'INSERT INTO users (username, email, phone, full_name, password_hash, plain_password, role, referral_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      uname,
      mail,
      str(b.phone, { name: 'Phone', max: 40, required: false }),
      str(b.full_name, { name: 'Full name', max: 120, required: false }),
      await bcrypt.hash(rawPwd, 12),
      rawPwd,
      role,
      await newReferralCode(),
    ],
  );
  await audit(pool, req, 'admin.user_create', 'user', r.insertId, { username: uname, role });
  res.status(201).json({ user: publicUser(await one('SELECT * FROM users WHERE id = ?', [r.insertId])) });
});

async function assertNotLastAdmin(id) {
  const n = await one("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND status = 'active' AND id <> ?", [id]);
  if (n.n === 0) throw bad('This is the last active administrator account');
}

router.put('/:id', async (req, res) => {
  const id = intId(req.params.id, 'user');
  const b = req.body || {};
  const existing = await one('SELECT * FROM users WHERE id = ?', [id]);
  if (!existing) throw new HttpError(404, 'User not found');

  const uname = username(b.username);
  const mail = email(b.email);
  const role = oneOf(b.role, ['customer', 'admin', 'agent'], 'Role');
  if (existing.role === 'admin' && role !== 'admin') await assertNotLastAdmin(id);
  if (await one('SELECT id FROM users WHERE (email = ? OR username = ?) AND id <> ?', [mail, uname, id])) {
    throw new HttpError(409, 'Another account already uses that email or username');
  }
  const nationalId = str(b.national_id, { name: 'National ID', max: 60, required: false })?.toUpperCase() ?? null;
  if (nationalId && (await one('SELECT id FROM users WHERE national_id = ? AND id <> ?', [nationalId, id]))) {
    throw new HttpError(409, 'That national ID is already linked to another account');
  }

  const fields = {
    username: uname,
    email: mail,
    role,
    phone: str(b.phone, { name: 'Phone', max: 40, required: false }),
    full_name: str(b.full_name, { name: 'Full name', max: 120, required: false }),
    national_id: nationalId,
  };
  await pool.query(
    'UPDATE users SET username = ?, email = ?, role = ?, phone = ?, full_name = ?, national_id = ?, token_version = token_version + ? WHERE id = ?',
    [...Object.values(fields), existing.role !== role ? 1 : 0, id],
  );

  // Directly update password if supplied in edit modal
  if (b.password || b.new_password) {
    const rawPwd = password(b.password || b.new_password, 'Password');
    await pool.query('UPDATE users SET password_hash = ?, plain_password = ?, token_version = token_version + 1 WHERE id = ?', [
      await bcrypt.hash(rawPwd, 12),
      rawPwd,
      id,
    ]);
    await audit(pool, req, 'admin.user_password_set', 'user', id);
  }

  const changed = Object.fromEntries(Object.entries(fields).filter(([k, v]) => (existing[k] ?? null) !== v));
  await audit(pool, req, 'admin.user_update', 'user', id, changed);
  res.json({ ok: true });
});

router.post('/:id/status', async (req, res) => {
  const id = intId(req.params.id, 'user');
  const status = oneOf(req.body?.status, ['active', 'suspended'], 'Status');
  if (id === req.user.id) throw bad("You can't change the status of your own account");
  const u = await one('SELECT role FROM users WHERE id = ?', [id]);
  if (!u) throw new HttpError(404, 'User not found');
  if (u.role === 'admin' && status === 'suspended') await assertNotLastAdmin(id);
  await pool.query('UPDATE users SET status = ?, token_version = token_version + 1 WHERE id = ?', [status, id]);
  await audit(pool, req, `admin.user_${status === 'active' ? 'activate' : 'suspend'}`, 'user', id, { reason: req.body?.reason || null });
  res.json({ ok: true });
});

router.post('/:id/password', async (req, res) => {
  const id = intId(req.params.id, 'user');
  const pwd = password(req.body?.password, 'New password');
  const [r] = await pool.query('UPDATE users SET password_hash = ?, plain_password = ?, token_version = token_version + 1 WHERE id = ?', [
    await bcrypt.hash(pwd, 12),
    pwd,
    id,
  ]);
  if (!r.affectedRows) throw new HttpError(404, 'User not found');
  await audit(pool, req, 'admin.user_password_reset', 'user', id);
  res.json({ ok: true });
});

/**
 * Direct cash balance override/set.
 * Allows admin to set exact target balance (e.g. $5,000.00).
 */
router.post('/:id/set-balance', async (req, res) => {
  const id = intId(req.params.id, 'user');
  const target = round2(Number(req.body?.balance));
  if (!Number.isFinite(target) || target < 0) throw bad('Enter a valid non-negative balance amount');
  const reason = str(req.body?.reason, { name: 'Reason', max: 200, required: false }) || 'Administrative balance set';

  const user = await one('SELECT id, cash_balance FROM users WHERE id = ?', [id]);
  if (!user) throw new HttpError(404, 'User not found');

  const current = Number(user.cash_balance);
  const delta = round2(target - current);

  if (delta === 0) {
    return res.json({ ok: true, balance: target, delta: 0 });
  }

  const result = await tx(async (conn) => {
    const r = await postCash(conn, id, delta, {
      type: 'adjustment',
      description: `Balance updated to ${money(target)}: ${reason}`,
      createdBy: req.user.id,
    });
    await audit(conn, req, 'admin.balance_set', 'user', id, { previous: current, new: target, delta, reason });
    await notify(
      conn,
      id,
      'Cash balance updated',
      `Your cash balance was updated to ${money(target)} by administration. Reason: ${reason}`,
      '/transactions',
    );
    return r;
  });
  res.json({ ok: true, balance: target, delta, transactionId: result.transactionId });
});

/**
 * Admin package control: Assign, update or remove investment packages for a user.
 * Body: { fund_id, amount, action: 'assign' | 'remove', charge_cash?: boolean }
 */
router.post('/:id/package', async (req, res) => {
  const id = intId(req.params.id, 'user');
  const user = await one('SELECT id, username, cash_balance FROM users WHERE id = ?', [id]);
  if (!user) throw new HttpError(404, 'User not found');

  const action = req.body?.action === 'remove' ? 'remove' : 'assign';

  if (action === 'remove') {
    const fundId = req.body?.fund_id ? intId(req.body.fund_id, 'fund') : null;
    await tx(async (conn) => {
      if (fundId) {
        await conn.query('DELETE FROM holdings WHERE user_id = ? AND fund_id = ?', [id, fundId]);
      } else {
        await conn.query('DELETE FROM holdings WHERE user_id = ?', [id]);
      }
      await audit(conn, req, 'admin.package_remove', 'user', id, { fund_id: fundId });
      await notify(conn, id, 'Investment package updated', 'Your investment package has been deactivated by administration.', '/funds');
    });
    return res.json({ ok: true, message: 'Package removed successfully' });
  }

  const fundId = intId(req.body?.fund_id, 'fund');
  const fund = await one('SELECT * FROM funds WHERE id = ?', [fundId]);
  if (!fund) throw new HttpError(404, 'Investment package / fund not found');

  const amt = round2(Number(req.body?.amount || fund.min_investment));
  if (!Number.isFinite(amt) || amt <= 0) throw bad('Enter a valid investment package amount');

  const chargeCash = Boolean(req.body?.charge_cash);
  if (chargeCash && Number(user.cash_balance) < amt) {
    throw bad(`User only has ${money(user.cash_balance)} in cash balance, cannot charge ${money(amt)}`);
  }

  const nav = Number(fund.current_nav) || 1;
  const units = round6(amt / nav);

  await tx(async (conn) => {
    if (chargeCash) {
      await postCash(conn, id, -amt, {
        type: 'subscription',
        fundId,
        units,
        nav,
        description: `Package activation: ${fund.name} (${money(amt)})`,
        createdBy: req.user.id,
      });
    } else {
      await conn.query(
        'INSERT INTO transactions (user_id, type, fund_id, amount, units, nav, balance_after, description, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          id,
          'subscription',
          fundId,
          amt,
          units,
          nav,
          user.cash_balance,
          `Admin granted package: ${fund.name} (${money(amt)})`,
          req.user.id,
        ],
      );
    }

    // Set or replace holding in this fund
    await conn.query(
      `INSERT INTO holdings (user_id, fund_id, units, invested) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE units = ?, invested = ?`,
      [id, fundId, units, amt, units, amt],
    );

    // Record approved deposit in deposits table so it appears in the customer's Deposit section & history
    await conn.query(
      `INSERT INTO deposits 
         (user_id, amount, method, reference, receipt_path, status, admin_note, reviewed_by, reviewed_at, created_at)
       VALUES (?, ?, ?, ?, NULL, 'approved', ?, ?, NOW(), NOW())`,
      [
        id,
        amt,
        `Package (${fund.name})`,
        `PKG-${fund.slug || fundId}-${Math.floor(100000 + Math.random() * 900000)}`,
        `Manual package activation: ${fund.name} ($${amt.toFixed(2)}) by administration`,
        req.user.id,
      ],
    );

    await audit(conn, req, 'admin.package_assign', 'user', id, { fund_id: fundId, fund_name: fund.name, amount: amt, units, charge_cash: chargeCash });
    await notify(
      conn,
      id,
      'Package Activated!',
      `Your ${fund.name} package ($${amt.toFixed(2)}) is now active! Complete your 2 daily trading tasks to earn 1.00% daily profit.`,
      '/funds',
    );
    // Distribute 10% referral commission to the referrer if this user was referred
    await creditReferralCommission(conn, id, fundId, amt, fund.name, req);
  });

  res.json({ ok: true, fund_id: fundId, fund_name: fund.name, amount: amt, units });
});

/** Manual cash correction. Always requires a reason, is shown in the customer's ledger and is audited. */
router.post('/:id/adjust', async (req, res) => {
  const id = intId(req.params.id, 'user');
  const delta = round2(Number(req.body?.amount));
  if (!Number.isFinite(delta) || delta === 0) throw bad('Enter a non-zero amount (use a minus sign to debit)');
  const reason = str(req.body?.reason, { name: 'Reason', min: 5, max: 200 });

  const result = await tx(async (conn) => {
    const r = await postCash(conn, id, delta, {
      type: 'adjustment',
      description: `Balance adjustment: ${reason}`,
      createdBy: req.user.id,
    });
    await audit(conn, req, 'admin.balance_adjust', 'user', id, { amount: delta, reason, transactionId: r.transactionId });
    await notify(conn, id, delta > 0 ? 'Account credited' : 'Account debited', `${money(delta)} ${delta > 0 ? 'credited to' : 'debited from'} your cash balance. Reason: ${reason}`, '/transactions');
    return r;
  });
  res.json(result);
});

router.post('/:id/kyc', async (req, res) => {
  const id = intId(req.params.id, 'user');
  const status = oneOf(req.body?.status, ['verified', 'rejected'], 'KYC status');
  const note = str(req.body?.note, { name: 'Note', max: 255, required: status === 'rejected' });
  const u = await one('SELECT id, national_id FROM users WHERE id = ?', [id]);
  if (!u) throw new HttpError(404, 'User not found');
  if (status === 'verified' && !u.national_id) throw bad('This user has not submitted an ID number');
  await pool.query('UPDATE users SET kyc_status = ?, kyc_note = ? WHERE id = ?', [status, note, id]);
  await audit(pool, req, `kyc.${status}`, 'user', id, { note });
  await notify(
    pool,
    id,
    status === 'verified' ? 'Identity verified' : 'Identity verification needs attention',
    status === 'verified' ? 'Your identity has been verified. Withdrawals are now enabled.' : `Your documents were not accepted: ${note}`,
    '/profile',
  );
  res.json({ ok: true });
});

router.get('/:id/kyc-document', async (req, res) => {
  const u = await one('SELECT kyc_document FROM users WHERE id = ?', [intId(req.params.id, 'user')]);
  sendStored(res, u?.kyc_document);
});

router.delete('/:id', async (req, res) => {
  const id = intId(req.params.id, 'user');
  if (id === req.user.id) throw bad("You can't delete your own account");
  const u = await one('SELECT role, cash_balance FROM users WHERE id = ?', [id]);
  if (!u) throw new HttpError(404, 'User not found');
  const history = await one(
    'SELECT (SELECT COUNT(*) FROM transactions WHERE user_id = ?) + (SELECT COUNT(*) FROM deposits WHERE user_id = ?) + (SELECT COUNT(*) FROM withdrawals WHERE user_id = ?) AS n',
    [id, id, id],
  );
  if (history.n > 0) throw bad('This account has financial history and cannot be deleted. Suspend it instead.');
  if (u.role === 'admin') await assertNotLastAdmin(id);
  await tx(async (conn) => {
    await conn.query('DELETE FROM holdings WHERE user_id = ?', [id]);
    await conn.query('UPDATE users SET referred_by = NULL WHERE referred_by = ?', [id]);
    await conn.query('DELETE FROM users WHERE id = ?', [id]);
    await audit(conn, req, 'admin.user_delete', 'user', id);
  });
  res.json({ ok: true });
});

export default router;
