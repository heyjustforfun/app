import { postCash } from './ledger.js';
import { round2 } from './validate.js';
import { audit, notify, notifyAdmins } from './activity.js';

/**
 * Distributes a 10% referral commission to the referrer when a referred user activates a package.
 * Must run inside an active database transaction (`conn`).
 */
export async function creditReferralCommission(conn, referredUserId, fundId, packageAmount, packageName, req = null) {
  const amt = round2(Number(packageAmount));
  if (!amt || amt <= 0) return { credited: false };

  // 1. Fetch referred user and their referrer ID
  const [[referredUser]] = await conn.query(
    'SELECT id, username, referred_by FROM users WHERE id = ? FOR UPDATE',
    [referredUserId],
  );
  if (!referredUser || !referredUser.referred_by) {
    return { credited: false };
  }

  const referrerId = referredUser.referred_by;

  // 2. Fetch referrer user details
  const [[referrer]] = await conn.query(
    'SELECT id, username, cash_balance FROM users WHERE id = ? FOR UPDATE',
    [referrerId],
  );
  if (!referrer) {
    return { credited: false };
  }

  // 3. Calculate 10% commission
  const commissionRate = 10.0;
  const commissionAmount = round2(amt * (commissionRate / 100));
  if (commissionAmount <= 0) {
    return { credited: false };
  }

  // 4. Credit the referrer's cash balance
  await postCash(conn, referrerId, commissionAmount, {
    type: 'adjustment',
    fundId,
    description: `10% Referral Commission - @${referredUser.username} activated ${packageName} ($${amt.toFixed(2)})`,
    createdBy: req?.user?.id || referredUserId,
  });

  // 5. Record commission in referral_commissions table
  await conn.query(
    `INSERT INTO referral_commissions 
       (referrer_id, referred_user_id, fund_id, package_name, package_amount, commission_rate, commission_amount)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      referrerId,
      referredUserId,
      fundId,
      packageName,
      amt,
      commissionRate,
      commissionAmount,
    ],
  );

  // 6. Notify the referrer
  await notify(
    conn,
    referrerId,
    '10% Referral Commission Credited! 🎁',
    `You earned +$${commissionAmount.toFixed(2)} (10% bonus) because your referral @${referredUser.username} activated the ${packageName} package ($${amt.toFixed(2)})!`,
    '/referrals',
  );

  // 7. Audit log & Admin alert
  if (req) {
    await audit(conn, req, 'referral.commission_paid', 'user', referrerId, {
      from_user_id: referredUserId,
      from_username: referredUser.username,
      package_name: packageName,
      package_amount: amt,
      commission: commissionAmount,
    });
  }

  await notifyAdmins(
    conn,
    'Referral Commission Paid',
    `@${referrer.username} earned +$${commissionAmount.toFixed(2)} (10% commission) from @${referredUser.username}'s ${packageName} package activation.`,
    `/admin/users?q=${referrer.username}`,
  );

  return {
    credited: true,
    referrerId,
    referrerUsername: referrer.username,
    commissionAmount,
  };
}
