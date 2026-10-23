import { Router } from 'express';
import { pool, query, one, tx } from '../../db.js';
import { slugify } from '../../migrate.js';
import { HttpError, amount, bad, intId, oneOf, page, round6, str } from '../../lib/validate.js';
import { postCash } from '../../lib/ledger.js';
import { audit, notify } from '../../lib/activity.js';
import { fundsWithPerformance } from '../public.js';

const router = Router();
const money = (n) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ---- Deposit approvals -----------------------------------------------------

router.get('/deposits', async (req, res) => {
  const status = req.query.status ? oneOf(String(req.query.status), ['pending', 'approved', 'rejected'], 'Status') : 'pending';
  const { limit, offset } = page(req, 100);
  res.json({
    deposits: await query(
      `SELECT d.id, d.user_id, d.amount, d.method, d.reference, d.receipt_path IS NOT NULL AS has_receipt, d.status, d.admin_note,
              d.reviewed_at, d.created_at, u.username, u.email, r.username AS reviewed_by_name
         FROM deposits d JOIN users u ON u.id = d.user_id LEFT JOIN users r ON r.id = d.reviewed_by
        WHERE d.status = ? ORDER BY d.id ${status === 'pending' ? 'ASC' : 'DESC'} LIMIT ? OFFSET ?`,
      [status, limit, offset],
    ),
  });
});

async function reviewDeposit(req, approve) {
  const id = intId(req.params.id, 'deposit');
  const note = str(req.body?.note, { name: 'Note', max: 255, required: !approve });
  return tx(async (conn) => {
    const [[d]] = await conn.query('SELECT * FROM deposits WHERE id = ? FOR UPDATE', [id]);
    if (!d) throw new HttpError(404, 'Deposit not found');
    if (d.status !== 'pending') throw bad(`This deposit was already ${d.status}`);

    await conn.query('UPDATE deposits SET status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?', [
      approve ? 'approved' : 'rejected',
      note,
      req.user.id,
      id,
    ]);
    if (approve) {
      await postCash(conn, d.user_id, Number(d.amount), {
        type: 'deposit',
        referenceId: id,
        description: `Deposit #${id} via ${d.method}`,
        createdBy: req.user.id,
      });
    }
    await audit(conn, req, approve ? 'deposit.approve' : 'deposit.reject', 'deposit', id, { amount: d.amount, note });
    await notify(
      conn,
      d.user_id,
      approve ? 'Deposit approved' : 'Deposit rejected',
      approve ? `${money(d.amount)} has been added to your available cash.` : `Your ${money(d.amount)} deposit was rejected: ${note}`,
      '/deposit',
    );
  });
}

router.post('/deposits/:id/approve', async (req, res) => {
  await reviewDeposit(req, true);
  res.json({ ok: true });
});

router.post('/deposits/:id/reject', async (req, res) => {
  await reviewDeposit(req, false);
  res.json({ ok: true });
});

// ---- Withdrawal settlements ------------------------------------------------

router.get('/withdrawals', async (req, res) => {
  const status = req.query.status ? oneOf(String(req.query.status), ['pending', 'paid', 'rejected'], 'Status') : 'pending';
  const { limit, offset } = page(req, 100);
  res.json({
    withdrawals: await query(
      `SELECT w.*, u.username, u.email, u.full_name, u.kyc_status, r.username AS reviewed_by_name
         FROM withdrawals w JOIN users u ON u.id = w.user_id LEFT JOIN users r ON r.id = w.reviewed_by
        WHERE w.status = ? ORDER BY w.id ${status === 'pending' ? 'ASC' : 'DESC'} LIMIT ? OFFSET ?`,
      [status, limit, offset],
    ),
  });
});

router.post('/withdrawals/:id/pay', async (req, res) => {
  const id = intId(req.params.id, 'withdrawal');
  const ref = str(req.body?.payout_reference, { name: 'Bank payout reference', max: 120 });
  const note = str(req.body?.note, { name: 'Note', max: 255, required: false });
  await tx(async (conn) => {
    const [[w]] = await conn.query('SELECT * FROM withdrawals WHERE id = ? FOR UPDATE', [id]);
    if (!w) throw new HttpError(404, 'Withdrawal not found');
    if (w.status !== 'pending') throw bad(`This withdrawal was already ${w.status}`);
    await conn.query("UPDATE withdrawals SET status = 'paid', payout_reference = ?, admin_note = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?", [
      ref,
      note,
      req.user.id,
      id,
    ]);
    const netPayout = Number(w.net_amount || Math.round(Number(w.amount) * 80) / 100);
    const feeCut = Number(w.fee_amount || Math.round(Number(w.amount) * 20) / 100);
    await audit(conn, req, 'withdrawal.paid', 'withdrawal', id, { amount: w.amount, net_amount: netPayout, fee_amount: feeCut, payout_reference: ref });
    await notify(conn, w.user_id, 'Withdrawal sent', `${money(netPayout)} net payout (${money(w.amount)} requested minus 20% company fee) was sent to ${w.bank_name}. Reference: ${ref}`, '/withdraw');
  });
  res.json({ ok: true });
});

router.post('/withdrawals/:id/reject', async (req, res) => {
  const id = intId(req.params.id, 'withdrawal');
  const note = str(req.body?.note, { name: 'Reason', max: 255 });
  await tx(async (conn) => {
    const [[w]] = await conn.query('SELECT * FROM withdrawals WHERE id = ? FOR UPDATE', [id]);
    if (!w) throw new HttpError(404, 'Withdrawal not found');
    if (w.status !== 'pending') throw bad(`This withdrawal was already ${w.status}`);
    await conn.query("UPDATE withdrawals SET status = 'rejected', admin_note = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?", [note, req.user.id, id]);
    // Release the held funds back to the customer's cash balance
    await postCash(conn, w.user_id, Number(w.amount), {
      type: 'withdrawal_reversal',
      referenceId: id,
      description: `Withdrawal #${id} returned: ${note}`,
      createdBy: req.user.id,
    });
    await audit(conn, req, 'withdrawal.reject', 'withdrawal', id, { amount: w.amount, note });
    await notify(conn, w.user_id, 'Withdrawal returned', `Your ${money(w.amount)} withdrawal was returned to your cash balance: ${note}`, '/withdraw');
  });
  res.json({ ok: true });
});

// ---- Funds & NAV -----------------------------------------------------------

router.get('/funds', async (_req, res) => {
  const funds = await fundsWithPerformance({ includeClosed: true });
  const stats = await query(
    'SELECT fund_id, COUNT(*) AS investors, SUM(units) AS units FROM holdings WHERE units > 0 GROUP BY fund_id',
  );
  res.json({
    funds: funds.map((f) => {
      const s = stats.find((x) => x.fund_id === f.id);
      const units = s ? Number(s.units) : 0;
      return { ...f, investors: s ? s.investors : 0, units_outstanding: units, aum: Math.round(units * f.current_nav * 100) / 100 };
    }),
  });
});

function fundFields(b) {
  return {
    name: str(b.name, { name: 'Fund name', min: 3, max: 120 }),
    tagline: str(b.tagline, { name: 'Tagline', max: 200, required: false }),
    description: str(b.description, { name: 'Description', max: 5000, required: false }),
    strategy: str(b.strategy, { name: 'Strategy', max: 255, required: false }),
    risk_level: oneOf(b.risk_level, ['low', 'medium', 'high'], 'Risk level'),
    min_investment: amount(b.min_investment, 'Minimum investment'),
    management_fee_pct: (() => {
      const n = Number(b.management_fee_pct);
      if (!Number.isFinite(n) || n < 0 || n > 10) throw bad('Management fee must be between 0 and 10%');
      return n;
    })(),
    status: oneOf(b.status || 'open', ['open', 'closed'], 'Status'),
    sort_order: Number.isInteger(Number(b.sort_order)) ? Number(b.sort_order) : 0,
  };
}

router.post('/funds', async (req, res) => {
  const f = fundFields(req.body || {});
  const nav = round6(Number(req.body?.initial_nav ?? 1));
  if (!(nav > 0)) throw bad('Initial NAV must be greater than zero');
  let slug = slugify(f.name);
  if (await one('SELECT id FROM funds WHERE slug = ?', [slug])) slug = `${slug}-${Date.now().toString(36)}`;

  const id = await tx(async (conn) => {
    const [r] = await conn.query(
      `INSERT INTO funds (name, slug, tagline, description, strategy, risk_level, min_investment, management_fee_pct, status, sort_order, current_nav)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [f.name, slug, f.tagline, f.description, f.strategy, f.risk_level, f.min_investment, f.management_fee_pct, f.status, f.sort_order, nav],
    );
    await conn.query("INSERT INTO nav_history (fund_id, nav, as_of, note, created_by) VALUES (?, ?, CURDATE(), 'Launch NAV', ?)", [
      r.insertId,
      nav,
      req.user.id,
    ]);
    await audit(conn, req, 'fund.create', 'fund', r.insertId, { ...f, nav });
    return r.insertId;
  });
  res.status(201).json({ id });
});

router.put('/funds/:id', async (req, res) => {
  const id = intId(req.params.id, 'fund');
  const f = fundFields(req.body || {});
  const [r] = await pool.query(
    `UPDATE funds SET name = ?, tagline = ?, description = ?, strategy = ?, risk_level = ?, min_investment = ?,
            management_fee_pct = ?, status = ?, sort_order = ? WHERE id = ?`,
    [f.name, f.tagline, f.description, f.strategy, f.risk_level, f.min_investment, f.management_fee_pct, f.status, f.sort_order, id],
  );
  if (!r.affectedRows) throw new HttpError(404, 'Fund not found');
  await audit(pool, req, 'fund.update', 'fund', id, f);
  res.json({ ok: true });
});

/**
 * Publishes the fund's net asset value per unit for a date. Valuations come from your
 * administrator / custodian statements; large moves need explicit confirmation.
 */
router.post('/funds/:id/nav', async (req, res) => {
  const id = intId(req.params.id, 'fund');
  const nav = round6(Number(req.body?.nav));
  if (!(nav > 0)) throw bad('NAV must be greater than zero');
  const asOf = String(req.body?.as_of || new Date().toISOString().slice(0, 10));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || Number.isNaN(Date.parse(asOf))) throw bad('Valuation date must be YYYY-MM-DD');
  if (asOf > new Date().toISOString().slice(0, 10)) throw bad("Valuation date can't be in the future");
  const note = str(req.body?.note, { name: 'Note', max: 255, required: false });

  const fund = await one('SELECT * FROM funds WHERE id = ?', [id]);
  if (!fund) throw new HttpError(404, 'Fund not found');
  const prev = await one('SELECT nav FROM nav_history WHERE fund_id = ? AND as_of < ? ORDER BY as_of DESC LIMIT 1', [id, asOf]);
  const move = prev ? Math.abs(nav / prev.nav - 1) : 0;
  if (move > 0.2 && !req.body?.confirm_large_change) {
    return res.status(409).json({
      error: `This NAV is ${(move * 100).toFixed(1)}% away from the previous valuation (${prev.nav}). Confirm to publish it.`,
      needs_confirmation: true,
    });
  }

  await tx(async (conn) => {
    await conn.query(
      'INSERT INTO nav_history (fund_id, nav, as_of, note, created_by) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE nav = VALUES(nav), note = VALUES(note), created_by = VALUES(created_by)',
      [id, nav, asOf, note, req.user.id],
    );
    await conn.query('UPDATE funds SET current_nav = (SELECT nav FROM nav_history WHERE fund_id = ? ORDER BY as_of DESC LIMIT 1) WHERE id = ?', [id, id]);
    await audit(conn, req, 'fund.nav_publish', 'fund', id, { nav, as_of: asOf, previous: prev?.nav ?? null, note });
  });
  res.json({ ok: true });
});

router.delete('/funds/:id/nav/:asOf', async (req, res) => {
  const id = intId(req.params.id, 'fund');
  const asOf = String(req.params.asOf);
  const count = await one('SELECT COUNT(*) AS n FROM nav_history WHERE fund_id = ?', [id]);
  if (count.n <= 1) throw bad("A fund must keep at least one NAV entry");
  await tx(async (conn) => {
    const [r] = await conn.query('DELETE FROM nav_history WHERE fund_id = ? AND as_of = ?', [id, asOf]);
    if (!r.affectedRows) throw new HttpError(404, 'NAV entry not found');
    await conn.query('UPDATE funds SET current_nav = (SELECT nav FROM nav_history WHERE fund_id = ? ORDER BY as_of DESC LIMIT 1) WHERE id = ?', [id, id]);
    await audit(conn, req, 'fund.nav_delete', 'fund', id, { as_of: asOf });
  });
  res.json({ ok: true });
});

function escapeSqlVal(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (val instanceof Date) {
    const d = new Date(val);
    const pad = (n) => String(n).padStart(2, '0');
    return `'${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}'`;
  }
  if (Buffer.isBuffer(val)) {
    return `X'${val.toString('hex')}'`;
  }
  const s = String(val)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\x00/g, '\\0');
  return `'${s}'`;
}

// ---- Database SQL Dump / Export --------------------------------------------

router.get('/export-database', async (req, res) => {
  try {
    const [[dbRow]] = await pool.query('SELECT DATABASE() AS db');
    const dbName = dbRow?.db || 'railway';

    const [tableRows] = await pool.query('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"');
    const tableNames = tableRows.map((r) => Object.values(r)[0]);

    let sql = `-- =====================================================================\n`;
    sql += `-- Complete Database SQL Dump\n`;
    sql += `-- Database: \`${dbName}\`\n`;
    sql += `-- Export Date: ${new Date().toISOString()}\n`;
    sql += `-- Total Tables: ${tableNames.length}\n`;
    sql += `-- =====================================================================\n\n`;
    sql += `SET FOREIGN_KEY_CHECKS = 0;\n`;
    sql += `SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";\n`;
    sql += `SET NAMES utf8mb4;\n`;
    sql += `SET time_zone = "+00:00";\n\n`;

    for (const table of tableNames) {
      const [[createRow]] = await pool.query(`SHOW CREATE TABLE \`${table}\``);
      const createTableSql = createRow['Create Table'] || Object.values(createRow)[1];

      sql += `-- ---------------------------------------------------------------------\n`;
      sql += `-- Table structure for table \`${table}\`\n`;
      sql += `-- ---------------------------------------------------------------------\n`;
      sql += `DROP TABLE IF EXISTS \`${table}\`;\n`;
      sql += `${createTableSql};\n\n`;

      const [rows] = await pool.query(`SELECT * FROM \`${table}\``);
      if (rows.length > 0) {
        sql += `-- Dumping data for table \`${table}\` (${rows.length} rows)\n`;
        sql += `LOCK TABLES \`${table}\` WRITE;\n`;
        const cols = Object.keys(rows[0]).map((c) => `\`${c}\``).join(', ');

        const chunkSize = 100;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          const valuesSql = chunk.map((r) => {
            const vals = Object.values(r).map(escapeSqlVal);
            return `(${vals.join(', ')})`;
          }).join(',\n  ');

          sql += `INSERT INTO \`${table}\` (${cols}) VALUES\n  ${valuesSql};\n`;
        }
        sql += `UNLOCK TABLES;\n\n`;
      }
    }

    sql += `SET FOREIGN_KEY_CHECKS = 1;\n`;
    sql += `-- Dump completed at: ${new Date().toISOString()}\n`;

    await audit(pool, req, 'database.export', 'database', null, { table_count: tableNames.length });

    const filename = `fund_portal_database_backup_${new Date().toISOString().slice(0, 10)}.sql`;
    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(sql);
  } catch (err) {
    console.error('Database export error:', err);
    res.status(500).json({ error: 'Failed to export database: ' + err.message });
  }
});

export default router;

