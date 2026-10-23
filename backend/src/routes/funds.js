import { Router } from 'express';
import { query, tx } from '../db.js';
import { HttpError, amount, bad, intId, round2, round6 } from '../lib/validate.js';
import { postCash } from '../lib/ledger.js';
import { audit, notify } from '../lib/activity.js';
import { creditReferralCommission } from '../lib/referral.js';
import { fundsWithPerformance } from './public.js';

const router = Router();
const money = (n) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

router.get('/', async (req, res) => {
  const funds = await fundsWithPerformance({ includeClosed: true });
  const holdings = await query('SELECT fund_id, units, invested FROM holdings WHERE user_id = ?', [req.user.id]);
  res.json({
    funds: funds
      .map((f) => {
        const h = holdings.find((x) => x.fund_id === f.id);
        const units = h ? Number(h.units) : 0;
        return { ...f, holding: { units, invested: h ? Number(h.invested) : 0, value: round2(units * f.current_nav) } };
      })
      // Closed funds stay visible only to people who still hold them
      .filter((f) => f.status === 'open' || f.holding.units > 0),
  });
});

router.post('/:id/invest', async (req, res) => {
  const fundId = intId(req.params.id, 'fund');
  const amt = amount(req.body?.amount);
  const uid = req.user.id;

  const result = await tx(async (conn) => {
    const [[f]] = await conn.query('SELECT * FROM funds WHERE id = ?', [fundId]);
    if (!f) throw new HttpError(404, 'Fund not found');
    if (f.status !== 'open') throw bad('This fund is not accepting new investments');

    const [[h]] = await conn.query('SELECT units FROM holdings WHERE user_id = ? AND fund_id = ? FOR UPDATE', [uid, fundId]);
    const firstInvestment = !h || Number(h.units) <= 0;
    if (firstInvestment && amt < Number(f.min_investment)) {
      throw bad(`The minimum initial investment for ${f.name} is ${money(f.min_investment)}`);
    }

    const nav = Number(f.current_nav);
    const units = round6(amt / nav);
    const { balance, transactionId } = await postCash(conn, uid, -amt, {
      type: 'subscription',
      fundId,
      units,
      nav,
      description: `Invested in ${f.name} at NAV ${nav.toFixed(6)}`,
      createdBy: uid,
    });
    await conn.query(
      `INSERT INTO holdings (user_id, fund_id, units, invested) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE units = units + VALUES(units), invested = invested + VALUES(invested)`,
      [uid, fundId, units, amt],
    );
    await audit(conn, req, 'fund.invest', 'fund', fundId, { amount: amt, units, nav, transactionId });
    await notify(conn, uid, 'Investment confirmed', `${money(amt)} invested in ${f.name} (${units.toFixed(4)} units at NAV ${nav.toFixed(4)}).`, '/funds');
    // Distribute 10% referral commission to the referrer if this user was referred
    await creditReferralCommission(conn, uid, fundId, amt, f.name, req);
    return { units, nav, balance };
  });
  res.json(result);
});

/** Body: { units } or { amount } or { all: true } */
router.post('/:id/redeem', async (req, res) => {
  const fundId = intId(req.params.id, 'fund');
  const uid = req.user.id;
  const b = req.body || {};

  const result = await tx(async (conn) => {
    const [[f]] = await conn.query('SELECT * FROM funds WHERE id = ?', [fundId]);
    if (!f) throw new HttpError(404, 'Fund not found');
    const [[h]] = await conn.query('SELECT units, invested FROM holdings WHERE user_id = ? AND fund_id = ? FOR UPDATE', [uid, fundId]);
    const held = h ? Number(h.units) : 0;
    if (held <= 0) throw bad(`You don't hold any units of ${f.name}`);

    const nav = Number(f.current_nav);
    let units;
    if (b.all) units = held;
    else if (b.units != null) units = round6(Number(b.units));
    else units = round6(amount(b.amount) / nav);
    if (!Number.isFinite(units) || units <= 0) throw bad('Enter a valid amount to redeem');
    // Treat tiny rounding leftovers as a full redemption
    if (units > held + 1e-6) throw bad(`You can redeem at most ${held.toFixed(6)} units`);
    if (held - units < 1e-4) units = held;

    const proceeds = round2(units * nav);
    if (proceeds <= 0) throw bad('Redemption amount is too small');
    const costReduction = round2((Number(h.invested) * units) / held);

    if (units === held) {
      await conn.query('UPDATE holdings SET units = 0, invested = 0 WHERE user_id = ? AND fund_id = ?', [uid, fundId]);
    } else {
      await conn.query('UPDATE holdings SET units = units - ?, invested = GREATEST(invested - ?, 0) WHERE user_id = ? AND fund_id = ?', [
        units,
        costReduction,
        uid,
        fundId,
      ]);
    }
    const { balance, transactionId } = await postCash(conn, uid, proceeds, {
      type: 'redemption',
      fundId,
      units: -units,
      nav,
      description: `Redeemed ${units.toFixed(4)} units of ${f.name} at NAV ${nav.toFixed(6)}`,
      createdBy: uid,
    });
    await audit(conn, req, 'fund.redeem', 'fund', fundId, { units, proceeds, nav, transactionId });
    await notify(conn, uid, 'Redemption completed', `${money(proceeds)} from ${f.name} was added to your available cash.`, '/funds');
    return { units, proceeds, nav, balance };
  });
  res.json(result);
});

router.get('/:id/nav', async (req, res) => {
  const rows = await query('SELECT nav, as_of, note FROM nav_history WHERE fund_id = ? ORDER BY as_of DESC LIMIT 500', [
    intId(req.params.id, 'fund'),
  ]);
  res.json({ history: rows });
});

export default router;
