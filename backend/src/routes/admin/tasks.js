import express from 'express';
import { one, pool, query, tx } from '../../db.js';
import { audit, notify } from '../../lib/activity.js';
import { postCash } from '../../lib/ledger.js';
import { sendStored } from '../../lib/upload.js';
import { HttpError, bad, intId, notFound, round2, str } from '../../lib/validate.js';

const router = express.Router();

/**
 * Dispatches trade task notifications and direct chat messages to targeted users.
 */
async function dispatchTaskToUsers(pool, task, senderId) {
  let targetUsers = [];
  if (task.target_type === 'specific' && task.target_user_id) {
    const u = await one(
      `SELECT u.id, u.username FROM users u
         JOIN holdings h ON h.user_id = u.id
        WHERE u.id = ? AND u.role = 'customer' AND u.status = 'active' AND h.units > 0`,
      [task.target_user_id],
    );
    if (u) targetUsers.push(u);
  } else if (task.target_package === 'package_1') {
    const [rows] = await pool.query(
      `SELECT DISTINCT u.id, u.username FROM users u
         JOIN holdings h ON h.user_id = u.id
        WHERE u.role = 'customer' AND u.status = 'active'
          AND (h.fund_id = 1 OR h.fund_id IN (SELECT id FROM funds WHERE min_investment = 250))
          AND h.units > 0`,
    );
    targetUsers = rows;
  } else if (task.target_package === 'package_2') {
    const [rows] = await pool.query(
      `SELECT DISTINCT u.id, u.username FROM users u
         JOIN holdings h ON h.user_id = u.id
        WHERE u.role = 'customer' AND u.status = 'active'
          AND (h.fund_id = 2 OR h.fund_id IN (SELECT id FROM funds WHERE min_investment = 500))
          AND h.units > 0`,
    );
    targetUsers = rows;
  } else if (task.target_package === 'package_3') {
    const [rows] = await pool.query(
      `SELECT DISTINCT u.id, u.username FROM users u
         JOIN holdings h ON h.user_id = u.id
        WHERE u.role = 'customer' AND u.status = 'active'
          AND (h.fund_id = 3 OR h.fund_id IN (SELECT id FROM funds WHERE min_investment = 1000))
          AND h.units > 0`,
    );
    targetUsers = rows;
  } else if (task.target_package === 'any_package') {
    const [rows] = await pool.query(
      `SELECT DISTINCT u.id, u.username FROM users u
         JOIN holdings h ON h.user_id = u.id
        WHERE u.role = 'customer' AND u.status = 'active' AND h.units > 0`,
    );
    targetUsers = rows;
  } else {
    // 'all' -> ONLY registered active customers with an activated package (units > 0)
    const [rows] = await pool.query(
      `SELECT DISTINCT u.id, u.username FROM users u
         JOIN holdings h ON h.user_id = u.id
        WHERE u.role = 'customer' AND u.status = 'active' AND h.units > 0`,
    );
    targetUsers = rows;
  }

  const code = task.task_code;
  const duration = task.trade_duration_seconds || 30;
  const expire = task.expire_minutes || 180;
  const expireHours = Math.round((expire / 60) * 10) / 10;
  const expireLabel = expire >= 60 ? `${expireHours} hours (${expire}m)` : `${expire}m`;

  for (const u of targetUsers) {
    // 1. Send system notification with deep link to tasks with prefilled code
    await notify(
      pool,
      u.id,
      `⚡ Daily Trade Task: ${code}`,
      `Task "${task.title}" is ready! Code: ${code}. 30s trade with 1.00% gross trade yield (50% user share = 0.50% profit credited to you). Expires in ${expireLabel}.`,
      `/tasks?code=${code}`,
    );

    // 2. Send staff chat message directly into user's chat thread
    const chatMsg = `⚡ [TRADE TASK DISPATCHED]
Task Code: ${code}
Title: ${task.title}
Trade Duration: ${duration}s | Expiration: ${expireLabel}
Profit Rule: 1.00% gross trade on total account balance per task · 50% to your cash balance + 50% to company pool (2 tasks = 1.00% net daily profit to you)

👉 Use Task Code: ${code}
Click or copy your code to activate in Daily Tasks (/tasks?code=${code}) to run your ${duration}-second trade session and receive profit!`;

    await pool.query(
      "INSERT INTO messages (user_id, sender_id, is_staff, body) VALUES (?, ?, 1, ?)",
      [u.id, senderId, chatMsg],
    );
  }
  return targetUsers.length;
}

/**
 * GET /api/admin/tasks
 * Lists tasks (filtered by optional date/status) and returns global task desk statistics.
 */
router.get('/', async (req, res) => {
  const dateFilter = req.query.date || null;
  const statusFilter = req.query.status || 'all';

  const where = [];
  const params = [];

  if (dateFilter && dateFilter !== 'all') {
    where.push('t.task_date = ?');
    params.push(dateFilter);
  }
  if (statusFilter && statusFilter !== 'all') {
    where.push('t.status = ?');
    params.push(statusFilter);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const tasks = await query(
    `SELECT t.*, u.username AS creator_username, tu.username AS target_username,
            (SELECT COUNT(*) FROM user_task_submissions s WHERE s.task_id = t.id) AS total_submissions,
            (SELECT COUNT(*) FROM user_task_submissions s WHERE s.task_id = t.id AND s.status = 'pending') AS pending_submissions,
            (SELECT COUNT(*) FROM user_task_submissions s WHERE s.task_id = t.id AND s.status = 'approved') AS approved_submissions,
            (SELECT COUNT(*) FROM user_task_submissions s WHERE s.task_id = t.id AND s.status = 'rejected') AS rejected_submissions
       FROM daily_tasks t
       LEFT JOIN users u ON u.id = t.created_by
       LEFT JOIN users tu ON tu.id = t.target_user_id
       ${whereSql}
      ORDER BY t.task_date DESC, t.task_slot ASC, t.id DESC`,
    params,
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const [stats] = await query(
    `SELECT
       (SELECT COUNT(*) FROM daily_tasks WHERE task_date = ?) AS tasks_today,
       (SELECT COUNT(*) FROM user_task_submissions WHERE status = 'pending') AS submissions_pending,
       (SELECT COUNT(*) FROM user_task_submissions WHERE status = 'approved') AS approved_all_time,
       (SELECT COALESCE(SUM(reward_paid), 0) FROM user_task_submissions WHERE status = 'approved') AS total_rewards_paid`,
    [todayStr],
  );

  res.json({
    tasks,
    today: todayStr,
    stats: {
      tasks_today: Number(stats?.tasks_today || 0),
      submissions_pending: Number(stats?.submissions_pending || 0),
      approved_all_time: Number(stats?.approved_all_time || 0),
      total_rewards_paid: round2(Number(stats?.total_rewards_paid || 0)),
    },
  });
});

/**
 * POST /api/admin/tasks
 * Creates a new daily task.
 */
router.post('/', async (req, res) => {
  const title = str(req.body.title, { name: 'Title', min: 3, max: 180 });
  const description = req.body.description ? String(req.body.description).trim() : null;
  const instructions = req.body.instructions ? String(req.body.instructions).trim() : null;
  const link_url = req.body.link_url ? String(req.body.link_url).trim().slice(0, 255) : null;
  const reward_amount = req.body.reward_amount !== undefined ? Math.max(0, round2(Number(req.body.reward_amount) || 0)) : 1.25;
  const task_date = req.body.task_date ? str(req.body.task_date, { name: 'Task Date' }) : new Date().toISOString().slice(0, 10);
  const task_slot = Math.max(1, Math.min(10, Number(req.body.task_slot) || 1));
  const target_type = req.body.target_type === 'specific' ? 'specific' : 'all';
  const target_user_id = target_type === 'specific' && req.body.target_user_id ? intId(req.body.target_user_id, 'Target User') : null;
  const target_package = req.body.target_package && ['all', 'package_1', 'package_2', 'package_3', 'any_package', 'specific'].includes(req.body.target_package)
    ? req.body.target_package
    : (target_type === 'specific' ? 'specific' : 'all');
  const task_code = req.body.task_code && String(req.body.task_code).trim()
    ? String(req.body.task_code).trim().toUpperCase().slice(0, 32)
    : `TSK-${Math.floor(100000 + Math.random() * 900000)}`;
  const trade_duration_seconds = Math.max(5, Math.min(3600, Number(req.body.trade_duration_seconds) || 30));
  const expire_minutes = Math.max(1, Math.min(10080, Number(req.body.expire_minutes) || 180));
  const expires_at = req.body.expires_at ? new Date(req.body.expires_at) : new Date(Date.now() + expire_minutes * 60 * 1000);
  const reward_mode = req.body.reward_mode === 'fixed' ? 'fixed' : 'percent_investment';
  const reward_pct = req.body.reward_pct !== undefined ? Math.max(0.01, Number(req.body.reward_pct) || 1.0) : 1.0;
  const requires_proof = req.body.requires_proof === false || req.body.requires_proof === 'false' ? 0 : 1;
  const status = req.body.status && ['active', 'inactive', 'archived'].includes(req.body.status) ? req.body.status : 'active';
  const notifyUsers = req.body.notify_users !== false && req.body.notify_users !== 'false';

  const [result] = await pool.query(
    `INSERT INTO daily_tasks
       (task_code, title, description, instructions, link_url, reward_amount, reward_mode, reward_pct,
        trade_duration_seconds, expire_minutes, expires_at, task_date, task_slot, target_type, target_package,
        target_user_id, requires_proof, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      task_code,
      title,
      description,
      instructions,
      link_url,
      reward_amount,
      reward_mode,
      reward_pct,
      trade_duration_seconds,
      expire_minutes,
      expires_at,
      task_date,
      task_slot,
      target_type,
      target_package,
      target_user_id,
      requires_proof,
      status,
      req.user.id,
    ],
  );

  const taskId = result.insertId;

  if (notifyUsers && status === 'active') {
    await dispatchTaskToUsers(
      pool,
      {
        id: taskId,
        title,
        task_code,
        trade_duration_seconds,
        expire_minutes,
        target_type,
        target_package,
        target_user_id,
      },
      req.user.id,
    );
  }

  await audit(pool, req, 'task.create', 'daily_task', taskId, {
    task_code,
    title,
    task_date,
    target_package,
    trade_duration_seconds,
    expire_minutes,
    reward_mode,
    reward_pct,
  });

  const [created] = await query('SELECT * FROM daily_tasks WHERE id = ?', [taskId]);
  res.status(201).json({ task: created });
});

/**
 * POST /api/admin/tasks/quick-generate
 * Generates 2 daily tasks for a given date (default today).
 * 2 tasks = exactly 1% of total investment on a daily basis (0.5% per task)!
 */
router.post('/quick-generate', async (req, res) => {
  const task_date = req.body.task_date ? str(req.body.task_date, { name: 'Task Date' }) : new Date().toISOString().slice(0, 10);
  const notifyUsers = req.body.notify_users !== false && req.body.notify_users !== 'false';
  const target_package = req.body.target_package && ['all', 'package_1', 'package_2', 'package_3', 'any_package', 'specific'].includes(req.body.target_package)
    ? req.body.target_package
    : 'all';
  const expire_minutes = Math.max(1, Math.min(10080, Number(req.body.expire_minutes) || 180));
  const trade_duration_seconds = Math.max(5, Math.min(3600, Number(req.body.trade_duration_seconds) || 30));
  const expires_at = new Date(Date.now() + expire_minutes * 60 * 1000);

  const tasksToCreate = [
    {
      slot: 1,
      task_code: `TSK-${Math.floor(100000 + Math.random() * 900000)}`,
      title: 'High-Frequency Arbitrage Trade #1',
      description: 'Execute a 30-second automated liquidity pool arbitrage trade session. 1.00% gross trade on total balance with 50/50 profit split (0.50% net profit credited to your cash balance).',
      instructions: 'Click Start Trade, monitor the 30-second order routing countdown, and receive your 50% share of the 1.00% trade yield instantly.',
      link_url: '/trade',
      reward_amount: 1.25,
      reward_mode: 'percent_investment',
      reward_pct: 1.000,
      requires_proof: 0,
    },
    {
      slot: 2,
      task_code: `TSK-${Math.floor(100000 + Math.random() * 900000)}`,
      title: 'Decentralized Market Maker Trade #2',
      description: 'Execute a 30-second liquidity balancing trade session. Completing this 2nd task yields another 1.00% gross trade (50/50 split), completing your full 1.00% daily net profit.',
      instructions: 'Click Start Trade, execute the 30-second transaction verification, and your 50% profit share is credited directly to your cash balance.',
      link_url: '/trade',
      reward_amount: 1.25,
      reward_mode: 'percent_investment',
      reward_pct: 1.000,
      requires_proof: 0,
    },
  ];

  const createdIds = [];
  for (const t of tasksToCreate) {
    const [r] = await pool.query(
      `INSERT INTO daily_tasks
         (task_code, title, description, instructions, link_url, reward_amount, reward_mode, reward_pct,
          trade_duration_seconds, expire_minutes, expires_at, task_date, task_slot, target_type, target_package,
          requires_proof, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'all', ?, ?, 'active', ?)`,
      [
        t.task_code,
        t.title,
        t.description,
        t.instructions,
        t.link_url,
        t.reward_amount,
        t.reward_mode,
        t.reward_pct,
        trade_duration_seconds,
        expire_minutes,
        expires_at,
        task_date,
        t.slot,
        target_package,
        t.requires_proof,
        req.user.id,
      ],
    );
    t.id = r.insertId;
    createdIds.push(r.insertId);
    await audit(pool, req, 'task.create', 'daily_task', r.insertId, { task_code: t.task_code, title: t.title, task_date });
  }

  if (notifyUsers) {
    for (const t of tasksToCreate) {
      await dispatchTaskToUsers(
        pool,
        {
          id: t.id,
          title: t.title,
          task_code: t.task_code,
          trade_duration_seconds,
          expire_minutes,
          target_type: 'all',
          target_package,
        },
        req.user.id,
      );
    }
  }

  res.json({ ok: true, created_count: createdIds.length, tasks: tasksToCreate, task_date });
});

/**
 * PUT /api/admin/tasks/:id
 * Updates an existing daily task.
 */
router.put('/:id', async (req, res) => {
  const taskId = intId(req.params.id, 'Task ID');
  const existing = await one('SELECT * FROM daily_tasks WHERE id = ?', [taskId]);
  if (!existing) throw notFound('Task not found');

  const title = req.body.title !== undefined ? str(req.body.title, { name: 'Title', min: 3, max: 180 }) : existing.title;
  const description = req.body.description !== undefined ? String(req.body.description).trim() : existing.description;
  const instructions = req.body.instructions !== undefined ? String(req.body.instructions).trim() : existing.instructions;
  const link_url = req.body.link_url !== undefined ? String(req.body.link_url).trim().slice(0, 255) : existing.link_url;
  const reward_amount = req.body.reward_amount !== undefined ? Math.max(0, round2(Number(req.body.reward_amount) || 0)) : existing.reward_amount;
  const reward_mode = req.body.reward_mode && ['fixed', 'percent_investment'].includes(req.body.reward_mode) ? req.body.reward_mode : (existing.reward_mode || 'percent_investment');
  const reward_pct = req.body.reward_pct !== undefined ? Math.max(0.01, Number(req.body.reward_pct) || 1.0) : Number(existing.reward_pct || 1.0);
  const task_code = req.body.task_code && String(req.body.task_code).trim() ? String(req.body.task_code).trim().toUpperCase().slice(0, 32) : (existing.task_code || `TSK-${taskId}`);
  const trade_duration_seconds = req.body.trade_duration_seconds !== undefined ? Math.max(5, Math.min(3600, Number(req.body.trade_duration_seconds) || 30)) : (existing.trade_duration_seconds || 30);
  const expire_minutes = req.body.expire_minutes !== undefined ? Math.max(1, Math.min(10080, Number(req.body.expire_minutes) || 180)) : (existing.expire_minutes || 180);
  const expires_at = req.body.expires_at ? new Date(req.body.expires_at) : (req.body.expire_minutes !== undefined ? new Date(Date.now() + expire_minutes * 60 * 1000) : existing.expires_at);
  const task_date = req.body.task_date !== undefined ? str(req.body.task_date, { name: 'Task Date' }) : existing.task_date;
  const task_slot = req.body.task_slot !== undefined ? Math.max(1, Math.min(10, Number(req.body.task_slot) || 1)) : existing.task_slot;
  const target_type = req.body.target_type && ['all', 'specific'].includes(req.body.target_type) ? req.body.target_type : existing.target_type;
  const target_package = req.body.target_package && ['all', 'package_1', 'package_2', 'package_3', 'any_package', 'specific'].includes(req.body.target_package) ? req.body.target_package : (existing.target_package || 'all');
  const target_user_id = target_type === 'specific' ? (req.body.target_user_id ? intId(req.body.target_user_id) : existing.target_user_id) : null;
  const requires_proof = req.body.requires_proof !== undefined ? (req.body.requires_proof ? 1 : 0) : existing.requires_proof;
  const status = req.body.status && ['active', 'inactive', 'archived'].includes(req.body.status) ? req.body.status : existing.status;

  await pool.query(
    `UPDATE daily_tasks
        SET task_code = ?, title = ?, description = ?, instructions = ?, link_url = ?, reward_amount = ?,
            reward_mode = ?, reward_pct = ?, trade_duration_seconds = ?, expire_minutes = ?, expires_at = ?,
            task_date = ?, task_slot = ?, target_type = ?, target_package = ?, target_user_id = ?, requires_proof = ?, status = ?
      WHERE id = ?`,
    [
      task_code,
      title,
      description,
      instructions,
      link_url,
      reward_amount,
      reward_mode,
      reward_pct,
      trade_duration_seconds,
      expire_minutes,
      expires_at,
      task_date,
      task_slot,
      target_type,
      target_package,
      target_user_id,
      requires_proof,
      status,
      taskId,
    ],
  );

  await audit(pool, req, 'task.update', 'daily_task', taskId, { task_code, title, status, reward_mode, reward_pct });
  const [updated] = await query('SELECT * FROM daily_tasks WHERE id = ?', [taskId]);
  res.json({ task: updated });
});

/**
 * POST /api/admin/tasks/:id/dispatch
 * Sends/resends a task directly to targeted users (Package 1, Package 2, Package 3, Any, All, or Specific) via notification and chat!
 */
router.post('/:id/dispatch', async (req, res) => {
  const taskId = intId(req.params.id, 'Task ID');
  const task = await one('SELECT * FROM daily_tasks WHERE id = ?', [taskId]);
  if (!task) throw notFound('Task not found');

  const target_package = req.body.target_package || task.target_package || 'all';
  const target_type = target_package === 'specific' ? 'specific' : (task.target_type || 'all');
  const target_user_id = req.body.target_user_id || task.target_user_id || null;

  const count = await dispatchTaskToUsers(
    pool,
    {
      ...task,
      target_package,
      target_type,
      target_user_id,
    },
    req.user.id,
  );

  await audit(pool, req, 'task.dispatch', 'daily_task', taskId, {
    task_code: task.task_code,
    title: task.title,
    target_package,
    recipient_count: count,
  });

  res.json({ ok: true, recipient_count: count, task_code: task.task_code });
});

/**
 * DELETE /api/admin/tasks/:id
 * Deletes a task.
 */
router.delete('/:id', async (req, res) => {
  const taskId = intId(req.params.id, 'Task ID');
  const existing = await one('SELECT * FROM daily_tasks WHERE id = ?', [taskId]);
  if (!existing) throw notFound('Task not found');

  await pool.query('DELETE FROM daily_tasks WHERE id = ?', [taskId]);
  await audit(pool, req, 'task.delete', 'daily_task', taskId, { title: existing.title });
  res.json({ ok: true });
});

/**
 * GET /api/admin/tasks/submissions
 * Lists user task submissions.
 */
router.get('/submissions', async (req, res) => {
  const statusFilter = req.query.status || 'all';
  const taskId = req.query.task_id ? intId(req.query.task_id) : null;

  const where = [];
  const params = [];

  if (statusFilter && statusFilter !== 'all') {
    where.push('s.status = ?');
    params.push(statusFilter);
  }
  if (taskId) {
    where.push('s.task_id = ?');
    params.push(taskId);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const submissions = await query(
    `SELECT s.*,
            u.username, u.email, u.full_name,
            t.title AS task_title, t.reward_amount, t.task_date, t.task_slot, t.requires_proof,
            r.username AS reviewer_username
       FROM user_task_submissions s
       JOIN daily_tasks t ON t.id = s.task_id
       JOIN users u ON u.id = s.user_id
       LEFT JOIN users r ON r.id = s.reviewed_by
       ${whereSql}
      ORDER BY (s.status = 'pending') DESC, s.created_at DESC LIMIT 200`,
    params,
  );

  res.json({ submissions });
});

/**
 * POST /api/admin/tasks/submissions/:id/review
 * Approves or rejects a user task submission. If approved, credits reward to user cash balance!
 */
router.post('/submissions/:id/review', async (req, res) => {
  const subId = intId(req.params.id, 'Submission ID');
  const action = req.body.action === 'approve' ? 'approve' : req.body.action === 'reject' ? 'reject' : null;
  if (!action) throw bad('Action must be "approve" or "reject"');
  const admin_note = req.body.admin_note ? String(req.body.admin_note).trim().slice(0, 255) : null;

  const result = await tx(async (conn) => {
    const [[sub]] = await conn.query(
      `SELECT s.*, t.title AS task_title, t.task_code, t.reward_amount, t.reward_mode, t.reward_pct, u.username
         FROM user_task_submissions s
         JOIN daily_tasks t ON t.id = s.task_id
         JOIN users u ON u.id = s.user_id
        WHERE s.id = ? FOR UPDATE`,
      [subId],
    );
    if (!sub) throw notFound('Submission not found');
    if (sub.status !== 'pending') throw bad(`This submission was already ${sub.status}`);

    let reward = Number(sub.reward_amount || 0);
    if (sub.reward_mode === 'percent_investment') {
      const [[investedRow]] = await conn.query(
        'SELECT COALESCE(SUM(invested), 0) AS total FROM holdings WHERE user_id = ? AND units > 0',
        [sub.user_id],
      );
      const totalInvested = Number(investedRow?.total || 0);
      if (totalInvested > 0) {
        reward = round2(totalInvested * (Number(sub.reward_pct || 0.5) / 100));
      } else if (reward <= 0) {
        reward = 1.25;
      }
    }

    if (action === 'approve') {
      await conn.query(
        `UPDATE user_task_submissions
            SET status = 'approved', reward_paid = ?, reviewed_by = ?, reviewed_at = NOW(), admin_note = ?
          WHERE id = ?`,
        [reward, req.user.id, admin_note, subId],
      );

      // If task has a positive reward amount, credit the cash balance and record in ledger
      if (reward > 0) {
        await postCash(conn, sub.user_id, reward, {
          type: 'adjustment',
          description: `Daily Trade Profit (${sub.task_code || 'TSK-' + sub.task_id})`,
          referenceId: sub.task_id,
          createdBy: req.user.id,
        });
      }

      await notify(
        conn,
        sub.user_id,
        'Daily Task Approved!',
        `Your submission for "${sub.task_title}" was approved.${reward > 0 ? ` $${reward.toFixed(2)} has been credited to your cash balance.` : ''}`,
        '/tasks',
      );

      await audit(conn, req, 'task.approve', 'task_submission', subId, {
        userId: sub.user_id,
        taskId: sub.task_id,
        reward,
        note: admin_note,
      });

      return { status: 'approved', rewardPaid: reward };
    } else {
      await conn.query(
        `UPDATE user_task_submissions
            SET status = 'rejected', reward_paid = 0, reviewed_by = ?, reviewed_at = NOW(), admin_note = ?
          WHERE id = ?`,
        [req.user.id, admin_note, subId],
      );

      await notify(
        conn,
        sub.user_id,
        'Daily Task Needs Revision',
        `Your submission for "${sub.task_title}" was not approved${admin_note ? `: ${admin_note}` : '. Please review task details and re-submit.'}`,
        '/tasks',
      );

      await audit(conn, req, 'task.reject', 'task_submission', subId, {
        userId: sub.user_id,
        taskId: sub.task_id,
        note: admin_note,
      });

      return { status: 'rejected', rewardPaid: 0 };
    }
  });

  res.json({ ok: true, result });
});

/**
 * GET /api/admin/tasks/submissions/:id/proof
 * Serves the submitted proof file.
 */
router.get('/submissions/:id/proof', async (req, res) => {
  const sub = await one('SELECT proof_file FROM user_task_submissions WHERE id = ?', [intId(req.params.id)]);
  if (!sub || !sub.proof_file) throw notFound('Proof file not found');
  sendStored(res, sub.proof_file);
});

export default router;
