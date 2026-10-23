import { HttpError, round2 } from './validate.js';

/**
 * Moves cash in or out of a user's wallet and records it in the ledger.
 * Must run inside a transaction (conn from tx()). `delta` is signed: + credits, - debits.
 */
export async function postCash(conn, userId, delta, meta) {
  const [[u]] = await conn.query('SELECT cash_balance FROM users WHERE id = ? FOR UPDATE', [userId]);
  if (!u) throw new HttpError(404, 'User not found');

  const next = round2(Number(u.cash_balance) + delta);
  if (next < 0) throw new HttpError(400, 'Insufficient available balance');

  await conn.query('UPDATE users SET cash_balance = ? WHERE id = ?', [next, userId]);
  const [r] = await conn.query(
    `INSERT INTO transactions
       (user_id, type, fund_id, amount, units, nav, balance_after, description, reference_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      meta.type,
      meta.fundId ?? null,
      round2(delta),
      meta.units ?? null,
      meta.nav ?? null,
      next,
      meta.description,
      meta.referenceId ?? null,
      meta.createdBy ?? null,
    ],
  );
  return { balance: next, transactionId: r.insertId };
}
