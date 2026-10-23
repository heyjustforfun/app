import express from 'express';
import { one, pool, query, tx } from '../db.js';
import { audit, notify, notifyAdmins } from '../lib/activity.js';
import { postCash } from '../lib/ledger.js';
import { removeFile, sendStored, storedPath, uploader } from '../lib/upload.js';
import { HttpError, bad, intId, notFound, round2 } from '../lib/validate.js';

const router = express.Router();

/**
 * Helper to fetch user active investments across funds/packages.
 */
async function getUserInvestmentInfo(userId) {
  const holdings = await query(
    `SELECT h.fund_id, h.units, h.invested, f.min_investment, f.slug, f.name
       FROM holdings h
       JOIN funds f ON f.id = h.fund_id
      WHERE h.user_id = ? AND h.units > 0`,
    [userId],
  );
  const totalInvested = round2(holdings.reduce((sum, h) => sum + Number(h.invested || 0), 0));
  const hasPackage1 = holdings.some((h) => h.fund_id === 1 || Number(h.min_investment) === 250);
  const hasPackage2 = holdings.some((h) => h.fund_id === 2 || Number(h.min_investment) === 500);
  const hasPackage3 = holdings.some((h) => h.fund_id === 3 || Number(h.min_investment) === 1000);
  const hasAnyPackage = totalInvested > 0;

  const userRow = await one('SELECT cash_balance FROM users WHERE id = ?', [userId]);
  const cashBalance = round2(Number(userRow?.cash_balance || 0));
  const totalBalance = round2(totalInvested + cashBalance);

  return {
    totalInvested,
    cashBalance,
    totalBalance,
    hasPackage1,
    hasPackage2,
    hasPackage3,
    hasAnyPackage,
    holdings,
  };
}

/**
 * GET /api/tasks
 * Returns today's daily tasks targeted to this user (filtered by activated package),
 * with personalized 0.5% yield reward calculations (2 tasks = 1% daily investment profit).
 */
router.get('/', async (req, res) => {
  const targetDate = req.query.date || new Date().toISOString().slice(0, 10);
  const { totalInvested, cashBalance, totalBalance, hasPackage1, hasPackage2, hasPackage3, hasAnyPackage } = await getUserInvestmentInfo(req.user.id);

  // Users without an activated package ($250, $500, or $1,000) do NOT receive daily tasks
  if (!hasAnyPackage) {
    const [allTimeRow] = await query(
      "SELECT COALESCE(SUM(reward_paid), 0) AS rewards_all_time FROM user_task_submissions WHERE user_id = ? AND status = 'approved'",
      [req.user.id],
    );

    return res.json({
      today: targetDate,
      tasks: [],
      requires_package: true,
      message: 'You must activate an investment package ($250, $500, or $1,000) to receive daily trade tasks.',
      user_investment: {
        total_invested: 0,
        cash_balance: cashBalance,
        total_balance: totalBalance,
        daily_yield_pct: 1.0,
        per_task_yield_pct: 0.5,
        has_package_1: false,
        has_package_2: false,
        has_package_3: false,
        has_active_package: false,
      },
      summary: {
        total_today: 0,
        completed_today: 0,
        pending_today: 0,
        rewards_today: 0,
        rewards_all_time: round2(Number(allTimeRow?.rewards_all_time || 0)),
      },
    });
  }

  const rawTasks = await query(
    `SELECT t.id, t.task_code, t.title, t.description, t.instructions, t.link_url,
            t.reward_amount, t.reward_mode, t.reward_pct, t.trade_duration_seconds,
            t.expire_minutes, t.expires_at, t.created_at, t.task_date, t.task_slot,
            t.target_type, t.target_package, t.target_user_id, t.requires_proof, t.status,
            s.id AS submission_id, s.status AS submission_status,
            s.proof_text, s.proof_file, s.reward_paid, s.admin_note, s.reviewed_at, s.created_at AS submitted_at
       FROM daily_tasks t
       LEFT JOIN user_task_submissions s ON s.task_id = t.id AND s.user_id = ?
      WHERE t.status = 'active'
        AND t.task_date = ?
      ORDER BY t.task_slot ASC, t.id ASC`,
    [req.user.id, targetDate],
  );

  const now = Date.now();
  const tasks = rawTasks
    .filter((t) => {
      // 1. Direct target user
      if (t.target_type === 'specific' || t.target_package === 'specific') {
        return Number(t.target_user_id) === Number(req.user.id);
      }
      // 2. Package targeted
      if (t.target_package === 'package_1') return hasPackage1;
      if (t.target_package === 'package_2') return hasPackage2;
      if (t.target_package === 'package_3') return hasPackage3;
      if (t.target_package === 'any_package') return hasAnyPackage;
      // 3. 'all' -> only investors with an active package
      return hasAnyPackage;
    })
    .map((t) => {
      // Each task executes a 1.00% gross trade on the wallet cash balance.
      // (Calculates strictly on wallet cash balance, fallback to package if balance is 0).
      const baseAmount = cashBalance > 0 ? cashBalance : totalInvested;
      const tradeRatePct = t.reward_mode === 'percent_investment' ? Number(t.reward_pct || 1.0) : 1.0;
      const grossTradeYield = baseAmount > 0
        ? round2(baseAmount * (tradeRatePct / 100))
        : (Number(t.reward_amount) > 0 ? Number(t.reward_amount) * 2 : 2.50);
      const userProfit = round2(grossTradeYield * 0.50);
      const companyProfit = round2(grossTradeYield - userProfit);

      const expireMs = t.expires_at
        ? new Date(t.expires_at).getTime()
        : new Date(t.created_at).getTime() + Number(t.expire_minutes || 180) * 60 * 1000;
      const isExpired = expireMs <= now;
      const secondsRemaining = isExpired ? 0 : Math.max(0, Math.floor((expireMs - now) / 1000));

      return {
        ...t,
        task_code: t.task_code || `TSK-${String(t.id).padStart(6, '0')}`,
        trade_duration_seconds: Number(t.trade_duration_seconds || 30),
        expire_minutes: Number(t.expire_minutes || 180),
        calculated_reward: userProfit,
        gross_trade_yield: grossTradeYield,
        company_profit: companyProfit,
        is_expired: isExpired,
        seconds_remaining: secondsRemaining,
      };
    });

  const completedToday = tasks.filter((t) => t.submission_status === 'approved').length;
  const pendingToday = tasks.filter((t) => t.submission_status === 'pending').length;
  const rewardsToday = round2(
    tasks.reduce((sum, t) => sum + (t.submission_status === 'approved' ? Number(t.reward_paid || t.calculated_reward) : 0), 0),
  );

  const [allTimeRow] = await query(
    "SELECT COALESCE(SUM(reward_paid), 0) AS rewards_all_time FROM user_task_submissions WHERE user_id = ? AND status = 'approved'",
    [req.user.id],
  );

  res.json({
    today: targetDate,
    tasks,
    user_investment: {
      total_invested: totalInvested,
      cash_balance: cashBalance,
      total_balance: totalBalance,
      daily_yield_pct: 1.0,
      per_task_yield_pct: 0.5,
      has_package_1: hasPackage1,
      has_package_2: hasPackage2,
      has_package_3: hasPackage3,
      has_active_package: hasAnyPackage,
    },
    summary: {
      total_today: tasks.length,
      completed_today: completedToday,
      pending_today: pendingToday,
      rewards_today: rewardsToday,
      rewards_all_time: round2(Number(allTimeRow?.rewards_all_time || 0)),
    },
  });
});

/**
 * GET /api/tasks/history
 * Returns the investor's task history and past submissions.
 */
router.get('/history', async (req, res) => {
  const submissions = await query(
    `SELECT s.*, t.title AS task_title, t.description AS task_description,
            t.task_code, t.reward_amount, t.trade_duration_seconds, t.task_date, t.task_slot, t.link_url
       FROM user_task_submissions s
       JOIN daily_tasks t ON t.id = s.task_id
      WHERE s.user_id = ?
      ORDER BY s.created_at DESC LIMIT 100`,
    [req.user.id],
  );

  res.json({ submissions });
});

/**
 * POST /api/tasks/activate-by-code
 * Activates and looks up a task using the unique code received in chat or notification.
 */
router.post('/activate-by-code', async (req, res) => {
  const code = String(req.body?.task_code || req.body?.code || '').trim().toUpperCase();
  if (!code) throw bad('Please enter a valid task code');

  const task = await one('SELECT * FROM daily_tasks WHERE UPPER(task_code) = ?', [code]);
  if (!task) throw notFound(`No trade task found with code "${code}"`);
  if (task.status !== 'active') throw bad('This trade task is no longer active');

  // Check package targeting FIRST
  const { totalInvested, cashBalance, totalBalance, hasPackage1, hasPackage2, hasPackage3, hasAnyPackage } = await getUserInvestmentInfo(req.user.id);
  if (!hasAnyPackage) {
    throw bad('Daily trade tasks require an active investment package ($250, $500, or $1,000). Please activate a package first.');
  }

  // Check expiration - strictly 3 hours (180 minutes) max!
  const now = Date.now();
  const expireMs = task.expires_at
    ? new Date(task.expires_at).getTime()
    : new Date(task.created_at).getTime() + Number(task.expire_minutes || 180) * 60 * 1000;
  if (expireMs <= now || task.status !== 'active') {
    throw bad(`Trade task code "${code}" has expired. Task codes are valid for 3 hours only and can no longer be used.`);
  }

  if (task.target_type === 'specific' || task.target_package === 'specific') {
    if (Number(task.target_user_id) !== Number(req.user.id)) throw bad('This trade task is not assigned to your account');
  } else if (task.target_package === 'package_1' && !hasPackage1) {
    throw bad('This trade task requires an activated Package 1 ($250 Basic Starter)');
  } else if (task.target_package === 'package_2' && !hasPackage2) {
    throw bad('This trade task requires an activated Package 2 ($500 Standard Growth)');
  } else if (task.target_package === 'package_3' && !hasPackage3) {
    throw bad('This trade task requires an activated Package 3 ($1000 Executive Elite)');
  }

  // Check completion
  const sub = await one(
    'SELECT status FROM user_task_submissions WHERE task_id = ? AND user_id = ?',
    [task.id, req.user.id],
  );
  if (sub && sub.status === 'approved') {
    throw bad(`You have already completed trade task ${code} today`);
  }

  const baseAmount = cashBalance > 0 ? cashBalance : totalInvested;
  const tradeRatePct = task.reward_mode === 'percent_investment' ? Number(task.reward_pct || 1.0) : 1.0;
  const grossTradeYield = baseAmount > 0
    ? round2(baseAmount * (tradeRatePct / 100))
    : (Number(task.reward_amount) > 0 ? Number(task.reward_amount) * 2 : 2.50);
  const calculated_reward = round2(grossTradeYield * 0.50);
  const company_profit = round2(grossTradeYield - calculated_reward);

  const durationSec = Number(task.trade_duration_seconds || 30);
  const seconds_remaining = Math.max(0, Math.floor((expireMs - now) / 1000));

  res.json({
    ok: true,
    task: {
      ...task,
      calculated_reward,
      gross_trade_yield: grossTradeYield,
      company_profit,
      totalInvested,
      cashBalance,
      totalBalance,
      trade_duration_seconds: durationSec,
      is_completed: false,
      is_expired: false,
      seconds_remaining,
    },
  });
});

/**
 * POST /api/tasks/:id/execute-trade
 * Executes the 30-second live trade task!
 * Generates 1.00% daily profit on activated investment, split 50% to user and 50% to admin!
 */
router.post('/:id/execute-trade', async (req, res) => {
  const taskId = intId(req.params.id, 'Task ID');

  const task = await one('SELECT * FROM daily_tasks WHERE id = ? AND status = ?', [taskId, 'active']);
  if (!task) throw notFound('Daily task not found or is no longer active');

  // Check package targeting FIRST
  const { totalInvested, cashBalance, totalBalance, hasPackage1, hasPackage2, hasPackage3, hasAnyPackage } = await getUserInvestmentInfo(req.user.id);
  if (!hasAnyPackage) {
    throw bad('You must activate an investment package ($250, $500, or $1,000) before you can execute daily trade tasks.');
  }

  // Check expiration - strictly 3 hours (180 minutes) max!
  const now = Date.now();
  const expireMs = task.expires_at
    ? new Date(task.expires_at).getTime()
    : new Date(task.created_at).getTime() + Number(task.expire_minutes || 180) * 60 * 1000;
  if (expireMs <= now || task.status !== 'active') {
    throw bad('This trade task has expired (3-hour limit reached). You can no longer execute trades with this task.');
  }

  if (task.target_type === 'specific' || task.target_package === 'specific') {
    if (Number(task.target_user_id) !== Number(req.user.id)) throw bad('This trade task is not assigned to your account');
  } else if (task.target_package === 'package_1' && !hasPackage1) {
    throw bad('This trade task requires an activated Package 1 ($250 Basic Starter)');
  } else if (task.target_package === 'package_2' && !hasPackage2) {
    throw bad('This trade task requires an activated Package 2 ($500 Standard Growth)');
  } else if (task.target_package === 'package_3' && !hasPackage3) {
    throw bad('This trade task requires an activated Package 3 ($1000 Executive Elite)');
  }

  // Check existing submission
  const existing = await one(
    'SELECT id, status, reward_paid FROM user_task_submissions WHERE task_id = ? AND user_id = ?',
    [taskId, req.user.id],
  );
  if (existing && existing.status === 'approved') {
    throw bad('You have already completed this trade task today and received your daily profit');
  }

  // Calculate task profit strictly on Wallet Cash Balance (fallback to package investment if balance is 0)
  const baseAmount = cashBalance > 0 ? cashBalance : totalInvested;
  const tradeRatePct = task.reward_mode === 'percent_investment' ? Number(task.reward_pct || 1.0) : 1.0;
  const grossTradeYield = baseAmount > 0
    ? round2(baseAmount * (tradeRatePct / 100))
    : (Number(task.reward_amount) > 0 ? Number(task.reward_amount) * 2 : 2.50);
  const userProfit = round2(grossTradeYield * 0.50);
  const companyProfit = round2(grossTradeYield - userProfit);

  const taskCode = task.task_code || `TSK-${String(task.id).padStart(6, '0')}`;
  const durationSec = Number(task.trade_duration_seconds || 30);
  const adminUser = await one("SELECT id, username FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1");

  // Execute ledger & submission in transaction
  await tx(async (conn) => {
    await conn.query(
      `INSERT INTO user_task_submissions
         (task_id, user_id, status, proof_text, reward_paid, reviewed_by, reviewed_at, admin_note)
       VALUES (?, ?, 'approved', ?, ?, NULL, NOW(), 'Automated 30-second live trade execution completed (1.00% trade, 50% user / 50% company split)')
       ON DUPLICATE KEY UPDATE
         status = 'approved',
         reward_paid = VALUES(reward_paid),
         proof_text = VALUES(proof_text),
         reviewed_at = NOW(),
         admin_note = VALUES(admin_note)`,
      [
        taskId,
        req.user.id,
        `Automated ${durationSec}s trade execution verified. Unique Task ID: ${taskCode}. 1.00% Trade Yield: $${grossTradeYield.toFixed(2)} (User 50%: +$${userProfit.toFixed(2)}, Company 50%: +$${companyProfit.toFixed(2)} on $${baseAmount.toFixed(2)} balance).`,
        userProfit,
      ],
    );

    // 1. Credit 50% profit to User cash balance (full 1.00% profit across 2 tasks)
    if (userProfit > 0) {
      await postCash(conn, req.user.id, userProfit, {
        type: 'adjustment',
        description: `Daily Trade Profit (${taskCode}) - 50% Share of 1.00% Trade on $${baseAmount.toFixed(2)} Balance`,
        referenceId: taskId,
        createdBy: req.user.id,
      });
    }

    await notify(
      conn,
      req.user.id,
      'Daily Trade Profit Credited!',
      `Trade session for task ${taskCode} completed! 1.00% trade generated $${grossTradeYield.toFixed(2)}. Your 50% share (+$${userProfit.toFixed(2)}) has been credited to your cash balance ($${companyProfit.toFixed(2)} retained by company). Complete 2 daily tasks to earn your full 1.00% daily profit!`,
      '/wallet',
    );

    if (adminUser) {
      await notify(
        conn,
        adminUser.id,
        'Daily Trade Task Completed',
        `@${req.user.username} completed 1.00% trade task ${taskCode} on $${baseAmount.toFixed(2)} balance. Gross: $${grossTradeYield.toFixed(2)} (User: +$${userProfit.toFixed(2)}, Company Pool: +$${companyProfit.toFixed(2)}).`,
        '/admin/tasks',
      );
    }
  });

  await audit(pool, req, 'task.execute_trade', 'daily_task', taskId, {
    task_code: taskCode,
    gross_trade_yield: grossTradeYield,
    user_profit: userProfit,
    company_profit: companyProfit,
    total_invested: totalInvested,
    cash_balance: cashBalance,
    total_balance: totalBalance,
    base_amount: baseAmount,
    duration_seconds: durationSec,
  });

  res.json({
    ok: true,
    task_code: taskCode,
    gross_trade_yield: grossTradeYield,
    user_profit: userProfit,
    company_profit: companyProfit,
    reward_paid: userProfit,
    total_invested: totalInvested,
    cash_balance: cashBalance,
    total_balance: totalBalance,
    base_amount: baseAmount,
    trade_pct: tradeRatePct,
    user_share_pct: 50,
    company_share_pct: 50,
    message: `30-second trade executed successfully! 1.00% trade ($${grossTradeYield.toFixed(2)}) generated. Your 50% share (+$${userProfit.toFixed(2)}) has been credited to your available cash. Complete 2 tasks to receive your full 1.00% daily profit.`,
  });
});

/**
 * POST /api/tasks/:id/submit
 * Submits completion proof for a daily task (manual fallback workflow).
 */
router.post('/:id/submit', uploader('task_proofs').single('proof'), async (req, res) => {
  const taskId = intId(req.params.id, 'Task ID');

  const { hasAnyPackage } = await getUserInvestmentInfo(req.user.id);
  if (!hasAnyPackage) {
    if (req.file) removeFile(storedPath('task_proofs', req.file));
    throw bad('You must activate an investment package ($250, $500, or $1,000) before submitting daily tasks.');
  }

  const task = await one(
    `SELECT * FROM daily_tasks
      WHERE id = ? AND status = 'active'
        AND (target_type = 'all' OR target_user_id = ?)`,
    [taskId, req.user.id],
  );
  if (!task) {
    if (req.file) removeFile(storedPath('task_proofs', req.file));
    throw notFound('Task not found or is no longer active');
  }

  // Check expiration - strictly 3 hours (180 minutes) max!
  const now = Date.now();
  const expireMs = task.expires_at
    ? new Date(task.expires_at).getTime()
    : new Date(task.created_at).getTime() + Number(task.expire_minutes || 180) * 60 * 1000;
  if (expireMs <= now || task.status !== 'active') {
    if (req.file) removeFile(storedPath('task_proofs', req.file));
    throw bad('This trade task has expired (3-hour limit reached). You can no longer submit proof for this task.');
  }

  const existing = await one('SELECT id, status FROM user_task_submissions WHERE task_id = ? AND user_id = ?', [taskId, req.user.id]);
  if (existing && existing.status === 'approved') {
    if (req.file) removeFile(storedPath('task_proofs', req.file));
    throw bad('This task has already been completed and approved');
  }

  const proofText = req.body.proof_text ? String(req.body.proof_text).trim() : null;
  const proofFile = req.file ? storedPath('task_proofs', req.file) : null;

  if (task.requires_proof && !proofText && !proofFile) {
    throw bad('Please provide a note or upload proof to complete this task');
  }

  try {
    await pool.query(
      `INSERT INTO user_task_submissions
         (task_id, user_id, status, proof_text, proof_file, reward_paid, admin_note, reviewed_by, reviewed_at)
       VALUES (?, ?, 'pending', ?, ?, 0, NULL, NULL, NULL)
       ON DUPLICATE KEY UPDATE
         status = 'pending',
         proof_text = VALUES(proof_text),
         proof_file = COALESCE(VALUES(proof_file), proof_file),
         admin_note = NULL,
         reviewed_by = NULL,
         reviewed_at = NULL,
         updated_at = NOW()`,
      [taskId, req.user.id, proofText, proofFile],
    );

    await notifyAdmins(
      pool,
      'New Daily Task Submission',
      `@${req.user.username} submitted proof for task "${task.title}".`,
      '/admin/tasks',
    );

    await audit(pool, req, 'task.submit', 'daily_task', taskId, {
      title: task.title,
      hasProofFile: Boolean(proofFile),
      hasProofText: Boolean(proofText),
    });

    const [sub] = await query('SELECT * FROM user_task_submissions WHERE task_id = ? AND user_id = ?', [taskId, req.user.id]);
    res.json({ ok: true, submission: sub });
  } catch (err) {
    if (req.file) removeFile(storedPath('task_proofs', req.file));
    throw err;
  }
});

/**
 * GET /api/tasks/submissions/:id/proof
 * Serves the submitted proof file for the owner (or admin).
 */
router.get('/submissions/:id/proof', async (req, res) => {
  const sub = await one('SELECT user_id, proof_file FROM user_task_submissions WHERE id = ?', [intId(req.params.id)]);
  if (!sub || !sub.proof_file) throw notFound('Proof file not found');
  if (sub.user_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'agent') throw new HttpError(403, 'Access denied');
  sendStored(res, sub.proof_file);
});

export default router;
