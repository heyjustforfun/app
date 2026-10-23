import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Landmark,
  Percent,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { useApi, useAuth, useToast } from '../../context/AppContext';
import { api, dateTime, usd } from '../../lib/api';
import { Badge, Card, Empty, ErrorBox, Field, Loading, Spinner, StatusBadge } from '../../components/ui';

export default function Withdraw() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const list = useApi('/withdrawals');
  const last = list.data?.withdrawals?.[0];
  const requiresKyc = Boolean(list.data?.requires_kyc);
  const minWithdrawal = Number(list.data?.min_withdrawal || 20);
  const [form, setForm] = useState({ amount: '', bank_name: '', account_name: user?.full_name || '', account_number: '' });
  const [busy, setBusy] = useState(false);
  const verified = user?.kyc_status === 'verified';
  const kycBlocked = requiresKyc && !verified;

  const cashBalance = Number(user?.cash_balance || 0);

  // Sync account holder name when user data loads
  useEffect(() => {
    if (user?.full_name && !form.account_name) {
      setForm((prev) => ({ ...prev, account_name: user.full_name }));
    }
  }, [user?.full_name]);

  // Verification may have been approved since sign-in, so fetch the latest status
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Pre-fill bank details from the most recent withdrawal
  const fillLast = () => {
    if (!last) return;
    setForm((prev) => ({
      ...prev,
      bank_name: last.bank_name || '',
      account_name: last.account_name || user?.full_name || '',
      account_number: last.account_number || '',
    }));
    toast.success(`Loaded details from last withdrawal (${last.bank_name})`);
  };

  // Quick percent selection buttons
  const setPercentAmount = (pct) => {
    if (cashBalance <= 0) return;
    const calc = Math.floor(cashBalance * pct * 100) / 100;
    setForm((prev) => ({ ...prev, amount: calc > 0 ? calc.toFixed(2) : '' }));
  };

  const parsedAmount = Math.max(0, Number(form.amount) || 0);
  const companyCutFee = Math.round(parsedAmount * 20) / 100; // 20% company cut
  const netPayout = Math.max(0, Math.round((parsedAmount - companyCutFee) * 100) / 100); // 80% net payout

  const hasCompleteBankDetails = Boolean(form.bank_name.trim() && form.account_name.trim() && form.account_number.trim());
  const isValidAmount = parsedAmount >= minWithdrawal && parsedAmount <= cashBalance;

  const submit = async (e) => {
    e.preventDefault();
    if (parsedAmount < minWithdrawal) {
      toast.error(`The minimum withdrawal is ${usd(minWithdrawal)}.`);
      return;
    }
    if (parsedAmount > cashBalance) {
      toast.error(`Insufficient balance. You have ${usd(cashBalance)} available to withdraw.`);
      return;
    }
    if (!hasCompleteBankDetails) {
      toast.error('Please fill in all destination bank / account details.');
      return;
    }
    setBusy(true);
    try {
      await api('/withdrawals', { method: 'POST', body: form });
      toast.success(`Withdrawal requested! Net payout of ${usd(netPayout)} (after 20% company fee) will be processed.`);
      setForm((prev) => ({ ...prev, amount: '' }));
      await refresh();
      list.reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 max-w-full overflow-hidden">
      {/* KYC Warning banner if identity required */}
      {kycBlocked && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
          <div className="flex items-start sm:items-center gap-3 text-sm text-amber-200">
            <ShieldAlert className="h-5 w-5 shrink-0 text-amber-400 mt-0.5 sm:mt-0" />
            <div>
              {user?.kyc_status === 'pending'
                ? 'Your identity documents are under review. Withdrawals unlock once you are verified.'
                : 'Withdrawals are sent only to identity-verified investors (one person, one ID).'}
            </div>
          </div>
          {user?.kyc_status !== 'pending' && (
            <Link to="/profile" className="btn btn-warn btn-sm self-start sm:self-auto shrink-0">
              Verify identity
            </Link>
          )}
        </div>
      )}

      {/* 20% Company Processing Fee Policy Banner - Mobile Friendly */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-cyan-950/40 via-ink-900 to-ink-900 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-cyan-500/30 bg-cyan-500/15 text-cyan-300">
              <Percent className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">Company Fee Policy</span>
                <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-semibold text-cyan-200 border border-cyan-500/30">
                  Fixed 20%
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-300 leading-relaxed">
                A standard <strong className="text-white">20% processing cut</strong> applies to all withdrawals. You will receive the net <strong className="text-emerald-400 font-semibold">80% payout</strong> directly in your bank account.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 font-mono text-xs shrink-0 self-stretch sm:self-auto justify-between sm:justify-start">
            <span className="text-zinc-400">Fee: <strong className="text-rose-400">20%</strong></span>
            <span className="text-zinc-600">|</span>
            <span className="text-emerald-400 font-bold">You Receive: 80%</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.3fr] items-start">
        {/* Main Withdrawal Request Card */}
        <Card
          title="Withdraw Payout"
          subtitle="Direct bank transfer processed in 1–2 business days"
          icon={ArrowDownLeft}
          className="overflow-hidden"
        >
          {/* Available Cash & Quick Percentage Select (Optimized for Mobile) */}
          <div className="mb-5 rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-950/25 via-ink-900 to-ink-950 p-4 sm:p-4.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                <Wallet className="h-4 w-4 text-emerald-400" />
                <span>Available Cash</span>
              </div>
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Ready to withdraw
              </span>
            </div>

            <div className="mt-2 flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
              <div className="font-mono text-3xl font-extrabold tracking-tight text-white">
                {usd(cashBalance)}
              </div>
              <div className="text-[11px] text-zinc-400">
                Min withdrawal: <span className="font-mono text-zinc-200">{usd(minWithdrawal)}</span>
              </div>
            </div>

            {/* Quick Amount Buttons (4-column responsive grid on mobile) */}
            <div className="mt-3.5">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Quick Select Percentage:
              </div>
              <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                {[
                  { label: '25%', pct: 0.25 },
                  { label: '50%', pct: 0.50 },
                  { label: '75%', pct: 0.75 },
                  { label: 'Max (100%)', pct: 1.0 },
                ].map((btn) => {
                  const targetAmt = cashBalance > 0 ? (Math.floor(cashBalance * btn.pct * 100) / 100).toFixed(2) : '0.00';
                  const isSelected = form.amount && Number(form.amount) === Number(targetAmt);
                  return (
                    <button
                      key={btn.label}
                      type="button"
                      onClick={() => setPercentAmount(btn.pct)}
                      disabled={cashBalance <= 0}
                      className={`flex flex-col items-center justify-center rounded-xl py-2 px-1 text-xs font-semibold transition-all min-h-[42px] touch-manipulation ${
                        isSelected
                          ? 'border border-emerald-500 bg-emerald-500/20 text-emerald-300 shadow-sm'
                          : 'border border-white/10 bg-white/5 text-zinc-300 hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-300'
                      } disabled:opacity-30 disabled:pointer-events-none`}
                    >
                      <span>{btn.label}</span>
                      <span className="text-[10px] font-mono text-zinc-400 font-normal">
                        {cashBalance > 0 ? usd(Number(targetAmt)) : '—'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {/* Amount Input */}
            <Field
              label="Amount to Withdraw (USD)"
              hint={cashBalance > 0 ? `Up to ${usd(cashBalance)} available` : 'No cash balance currently available'}
            >
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-base font-bold text-zinc-500">
                  $
                </span>
                <input
                  className="input pl-8 font-mono text-base sm:text-lg font-bold text-white tracking-wide"
                  type="number"
                  inputMode="decimal"
                  min={minWithdrawal}
                  step="0.01"
                  max={cashBalance}
                  required
                  value={form.amount}
                  placeholder="0.00"
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
            </Field>

            {/* Bank Information Header & Quick Prefill Button */}
            <div className="pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Landmark className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Destination Bank Account</span>
                </div>
                {last && (
                  <button
                    type="button"
                    onClick={fillLast}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition touch-manipulation"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>Use Last Bank ({last.bank_name})</span>
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <Field label="Bank Name">
                  <input
                    className="input"
                    required
                    value={form.bank_name}
                    placeholder="e.g. JPMorgan Chase, Standard Chartered, Meezan Bank"
                    onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                  />
                </Field>

                <Field label="Account Holder Name" hint="Must match your verified full legal name">
                  <input
                    className="input"
                    required
                    value={form.account_name}
                    placeholder="Full name as it appears on bank account"
                    onChange={(e) => setForm({ ...form, account_name: e.target.value })}
                  />
                </Field>

                <Field label="Account Number / IBAN">
                  <input
                    className="input font-mono"
                    required
                    value={form.account_number}
                    placeholder="Bank account number or international IBAN"
                    onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                  />
                </Field>
              </div>
            </div>

            {/* ========================================================= */}
            {/* DEDICATED LIVE WITHDRAWAL PREVIEW MODULE (Mobile Optimized) */}
            {/* ========================================================= */}
            <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-ink-950 via-ink-900 to-ink-950 p-4 shadow-xl shadow-black/40">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-500/20 text-emerald-300">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-white">
                    Live Withdrawal Preview
                  </span>
                </div>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  Instant Quote
                </span>
              </div>

              {/* Net Payout Hero Callout */}
              <div className="my-3.5 rounded-xl border border-white/5 bg-black/40 p-3.5 text-center sm:text-left sm:flex sm:items-center sm:justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    Expected Net Payout (80%)
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    Amount you will receive in your account
                  </div>
                </div>
                <div className="mt-2 sm:mt-0 font-mono text-3xl font-extrabold text-emerald-400 tracking-tight">
                  {usd(netPayout)}
                </div>
              </div>

              {/* Financial Calculation Breakdown */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center text-zinc-300">
                  <span className="text-zinc-400">Gross Withdrawal Amount:</span>
                  <span className="font-mono font-semibold text-white">
                    {usd(parsedAmount)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-rose-300">
                  <span className="text-zinc-400">Company Fee (20% cut):</span>
                  <span className="font-mono font-semibold text-rose-400">
                    -{usd(companyCutFee)}
                  </span>
                </div>
                <div className="h-px bg-white/10 my-1" />
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-emerald-300">Net Transferred to You:</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    +{usd(netPayout)}
                  </span>
                </div>
              </div>

              {/* Destination Bank Account Preview */}
              <div className="mt-3.5 rounded-xl border border-white/5 bg-ink-900/80 p-3 text-xs space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Building2 className="h-3 w-3 text-zinc-400" />
                  <span>Transfer Destination</span>
                </div>
                <div className="flex items-center justify-between text-zinc-200">
                  <span className="text-zinc-400">Bank:</span>
                  <span className="font-semibold text-white truncate max-w-[180px]">
                    {form.bank_name.trim() || <span className="text-zinc-600 italic">Enter bank name</span>}
                  </span>
                </div>
                <div className="flex items-center justify-between text-zinc-200">
                  <span className="text-zinc-400">Account Holder:</span>
                  <span className="font-medium truncate max-w-[180px]">
                    {form.account_name.trim() || <span className="text-zinc-600 italic">Enter holder name</span>}
                  </span>
                </div>
                <div className="flex items-center justify-between text-zinc-200">
                  <span className="text-zinc-400">Account / IBAN:</span>
                  <span className="font-mono text-zinc-300">
                    {form.account_number.trim()
                      ? form.account_number.length > 8
                        ? `•••• ${form.account_number.slice(-4)}`
                        : form.account_number
                      : <span className="text-zinc-600 italic">Enter account number</span>}
                  </span>
                </div>
              </div>

              {/* Processing Guarantee Footnote */}
              <div className="mt-3 flex items-center gap-2 text-[11px] text-zinc-400">
                <Clock className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                <span>Processed by Treasury within 1–2 business days</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="btn btn-primary w-full !py-3.5 font-bold text-sm sm:text-base tracking-wide shadow-lg shadow-emerald-500/15 transition-all touch-manipulation"
              disabled={busy || kycBlocked || parsedAmount <= 0 || parsedAmount > cashBalance || !hasCompleteBankDetails}
            >
              {busy ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner className="!text-ink-950" /> Processing Request...
                </span>
              ) : kycBlocked ? (
                'Identity Verification Required to Withdraw'
              ) : cashBalance <= 0 ? (
                'No Available Cash Balance'
              ) : parsedAmount <= 0 ? (
                'Enter Amount to Withdraw'
              ) : parsedAmount < minWithdrawal ? (
                `Minimum Withdrawal is ${usd(minWithdrawal)}`
              ) : parsedAmount > cashBalance ? (
                `Amount Exceeds Available Cash (${usd(cashBalance)})`
              ) : !hasCompleteBankDetails ? (
                'Enter Destination Bank Details'
              ) : (
                `Confirm & Request Withdrawal (${usd(netPayout)} Net)`
              )}
            </button>
          </form>
        </Card>

        {/* Withdrawal History Card - Responsive Table (Desktop) + Mobile Cards (Phone) */}
        <Card title="Withdrawal History" subtitle="Your past and pending payout requests">
          {list.loading && !list.data ? (
            <Loading />
          ) : list.error ? (
            <ErrorBox error={list.error} onRetry={list.reload} />
          ) : list.data.withdrawals.length === 0 ? (
            <Empty title="No withdrawals yet" text="When you request a payout, it will appear here with live tracking status." />
          ) : (
            <>
              {/* MOBILE VIEW (Visible on mobile screens < 768px) */}
              <div className="space-y-3 md:hidden">
                {list.data.withdrawals.map((w) => {
                  const gross = Number(w.amount || 0);
                  const fee = Number(w.fee_amount != null ? w.fee_amount : gross * 0.20);
                  const net = Number(w.net_amount != null ? w.net_amount : gross - fee);

                  return (
                    <div
                      key={w.id}
                      className="rounded-xl border border-white/10 bg-ink-900 p-4 space-y-3"
                    >
                      {/* Top Row: ID, Status, and Date */}
                      <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-zinc-400">
                            #{w.id}
                          </span>
                          <StatusBadge status={w.status} />
                        </div>
                        <span className="text-[11px] text-zinc-500 whitespace-nowrap">
                          {dateTime(w.created_at)}
                        </span>
                      </div>

                      {/* Middle: Net Payout Hero & Gross/Fee details */}
                      <div className="flex items-baseline justify-between">
                        <div>
                          <div className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                            Net Payout (80%)
                          </div>
                          <div className="font-mono text-2xl font-bold text-emerald-400">
                            {usd(net)}
                          </div>
                        </div>
                        <div className="text-right text-xs space-y-0.5">
                          <div className="text-zinc-400">
                            Gross: <span className="font-mono font-medium text-white">{usd(gross)}</span>
                          </div>
                          <div className="text-rose-400 font-mono text-[11px]">
                            Fee 20%: -{usd(fee)}
                          </div>
                        </div>
                      </div>

                      {/* Destination Details */}
                      <div className="rounded-lg border border-white/5 bg-ink-950 p-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500">Destination:</span>
                          <span className="font-semibold text-white">{w.bank_name}</span>
                        </div>
                        <div className="flex items-center justify-between mt-1 text-zinc-400 font-mono text-[11px]">
                          <span>Account:</span>
                          <span>••••{String(w.account_number).slice(-4)} ({w.account_name || 'Holder'})</span>
                        </div>
                        {w.payout_reference && (
                          <div className="mt-1 pt-1 border-t border-white/5 flex items-center justify-between text-[11px]">
                            <span className="text-zinc-500">Reference:</span>
                            <span className="font-mono text-emerald-300">{w.payout_reference}</span>
                          </div>
                        )}
                        {w.status === 'rejected' && w.admin_note && (
                          <div className="mt-2 rounded bg-rose-500/10 border border-rose-500/20 p-2 text-rose-300 text-[11px]">
                            <strong>Admin Note:</strong> {w.admin_note}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP VIEW (Visible on >= 768px md screens) */}
              <div className="hidden md:block table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th className="text-right">Gross</th>
                      <th className="text-right">Fee (20%)</th>
                      <th className="text-right">Net Payout</th>
                      <th>Bank & Account</th>
                      <th>Status</th>
                      <th>Requested</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.data.withdrawals.map((w) => {
                      const gross = Number(w.amount || 0);
                      const fee = Number(w.fee_amount != null ? w.fee_amount : gross * 0.20);
                      const net = Number(w.net_amount != null ? w.net_amount : gross - fee);

                      return (
                        <tr key={w.id}>
                          <td className="font-mono text-zinc-500">#{w.id}</td>
                          <td className="text-right font-mono font-semibold text-zinc-300">{usd(gross)}</td>
                          <td className="text-right font-mono text-rose-400 text-xs">-{usd(fee)}</td>
                          <td className="text-right font-mono font-bold text-emerald-400">{usd(net)}</td>
                          <td className="text-xs">
                            <div className="font-medium text-white">{w.bank_name}</div>
                            <div className="font-mono text-zinc-500">••••{String(w.account_number).slice(-4)}</div>
                          </td>
                          <td>
                            <StatusBadge status={w.status} />
                            {w.payout_reference && <div className="mt-1 font-mono text-[10px] text-zinc-500">Ref {w.payout_reference}</div>}
                            {w.status === 'rejected' && w.admin_note && <div className="mt-1 max-w-48 text-[11px] text-rose-300">{w.admin_note}</div>}
                          </td>
                          <td className="whitespace-nowrap text-zinc-500 text-xs">{dateTime(w.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

