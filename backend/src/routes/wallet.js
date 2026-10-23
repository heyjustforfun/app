import { Router } from 'express';
import { pool, query, one, tx } from '../db.js';
import { getSettings } from '../migrate.js';
import { HttpError, amount, bad, intId, round2, str } from '../lib/validate.js';
import { postCash } from '../lib/ledger.js';
import { audit, notifyAdmins } from '../lib/activity.js';
import { uploader, storedPath, removeFile, sendStored } from '../lib/upload.js';

const router = Router();
const money = (n) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ---- Deposits --------------------------------------------------------------

router.get('/deposits/instructions', async (_req, res) => {
  res.json({
    instructions: await getSettings([
      'bank_name',
      'bank_account_name',
      'bank_account_number',
      'bank_iban',
      'bank_swift',
      'binance_id',
      'deposit_instructions',
      'min_deposit',
    ]),
  });
});

router.get('/deposits', async (req, res) => {
  res.json({
    deposits: await query(
      'SELECT id, amount, method, reference, receipt_path IS NOT NULL AS has_receipt, status, admin_note, reviewed_at, created_at FROM deposits WHERE user_id = ? ORDER BY id DESC LIMIT 200',
      [req.user.id],
    ),
  });
});

router.post('/deposits', uploader('receipts').single('receipt'), async (req, res) => {
  try {
    const amt = amount(req.body?.amount);
    const { min_deposit } = await getSettings(['min_deposit']);
    if (amt < Number(min_deposit || 0)) throw bad(`The minimum deposit is ${money(min_deposit)}`);
    const method = str(req.body?.method, { name: 'Payment method', max: 40 });
    const reference = str(req.body?.reference, { name: 'Transfer reference', max: 120, required: false });
    if (!req.file && !reference) throw bad('Please enter the Transaction ID / TxID or upload your payment screenshot/receipt');

    const pending = await one("SELECT COUNT(*) AS n FROM deposits WHERE user_id = ? AND status = 'pending'", [req.user.id]);
    if (pending.n >= 5) throw bad('You already have 5 deposits awaiting review. Please wait for them to be processed.');

    const [r] = await pool.query('INSERT INTO deposits (user_id, amount, method, reference, receipt_path) VALUES (?, ?, ?, ?, ?)', [
      req.user.id,
      amt,
      method,
      reference,
      storedPath('receipts', req.file),
    ]);
    await audit(pool, req, 'deposit.submit', 'deposit', r.insertId, { amount: amt });
    await notifyAdmins(pool, 'New deposit to review', `@${req.user.username} submitted a ${money(amt)} deposit.`, '/admin/deposits');
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    if (req.file) removeFile(storedPath('receipts', req.file));
    throw err;
  }
});

router.get('/deposits/:id/receipt', async (req, res) => {
  const d = await one('SELECT user_id, receipt_path FROM deposits WHERE id = ?', [intId(req.params.id)]);
  if (!d || (d.user_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'agent')) throw new HttpError(404, 'Receipt not found');
  sendStored(res, d.receipt_path);
});

// ---- Withdrawals -----------------------------------------------------------

router.get('/withdrawals', async (req, res) => {
  const s = await getSettings(['min_withdrawal', 'withdrawal_requires_kyc', 'withdrawal_fee_pct']);
  res.json({
    withdrawals: await query(
      'SELECT id, amount, fee_pct, fee_amount, net_amount, bank_name, account_name, account_number, status, payout_reference, admin_note, reviewed_at, created_at FROM withdrawals WHERE user_id = ? ORDER BY id DESC LIMIT 200',
      [req.user.id],
    ),
    fee_pct: Number(s.withdrawal_fee_pct || 20),
    min_withdrawal: Number(s.min_withdrawal || 20),
    requires_kyc: s.withdrawal_requires_kyc === '1',
  });
});

router.post('/withdrawals', async (req, res) => {
  const b = req.body || {};
  const amt = amount(b.amount);
  const bankName = str(b.bank_name, { name: 'Bank name', max: 120 });
  const accountName = str(b.account_name, { name: 'Account holder name', max: 120 });
  const accountNumber = str(b.account_number, { name: 'Account number / IBAN', min: 4, max: 60 });

  const s = await getSettings(['min_withdrawal', 'withdrawal_requires_kyc', 'withdrawal_fee_pct']);
  if (amt < Number(s.min_withdrawal || 0)) throw bad(`The minimum withdrawal is ${money(s.min_withdrawal)}`);
  const user = await one('SELECT kyc_status, cash_balance FROM users WHERE id = ?', [req.user.id]);
  if (s.withdrawal_requires_kyc === '1' && user.kyc_status !== 'verified') {
    throw bad('Please complete identity verification (Profile & Security) before withdrawing');
  }

  if (amt > Number(user.cash_balance || 0)) {
    throw bad(`Insufficient cash balance. You have ${money(user.cash_balance)} available to withdraw.`);
  }

  // 20% standard company deduction on all withdrawals
  const feePct = 20.0;
  const feeAmount = round2(amt * (feePct / 100));
  const netAmount = round2(amt - feeAmount);

  const id = await tx(async (conn) => {
    const [r] = await conn.query(
      'INSERT INTO withdrawals (user_id, amount, fee_pct, fee_amount, net_amount, bank_name, account_name, account_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, amt, feePct, feeAmount, netAmount, bankName, accountName, accountNumber],
    );
    // Funds are held immediately so they can't be invested or withdrawn twice
    await postCash(conn, req.user.id, -amt, {
      type: 'withdrawal',
      referenceId: r.insertId,
      description: `Withdrawal #${r.insertId} to ${bankName} (Gross: $${amt.toFixed(2)}, 20% Company Cut: $${feeAmount.toFixed(2)}, Net Payout: $${netAmount.toFixed(2)})`,
      createdBy: req.user.id,
    });
    await audit(conn, req, 'withdrawal.request', 'withdrawal', r.insertId, {
      amount: amt,
      fee_pct: feePct,
      fee_amount: feeAmount,
      net_amount: netAmount,
    });
    return r.insertId;
  });
  await notifyAdmins(
    pool,
    'New withdrawal request',
    `@${req.user.username} requested a ${money(amt)} withdrawal (Net Payout: ${money(netAmount)}, Company Cut 20%: ${money(feeAmount)}).`,
    '/admin/withdrawals',
  );
  res.status(201).json({ id, amount: amt, fee_pct: feePct, fee_amount: feeAmount, net_amount: netAmount });
});

export default router;
