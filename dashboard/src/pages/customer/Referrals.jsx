import { useState } from 'react';
import { Award, Check, Coins, Copy, DollarSign, Gift, Sparkles, TrendingUp, Users } from 'lucide-react';
import { useApi } from '../../context/AppContext';
import { date, dateTime, usd } from '../../lib/api';
import { Badge, Card, Empty, ErrorBox, Loading } from '../../components/ui';

export default function Referrals() {
  const { data, loading, error, reload } = useApi('/me/referrals');
  const [copied, setCopied] = useState('');

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const basePath = window.location.pathname.startsWith('/app') ? '/app' : '';
  const link = `${window.location.origin}${basePath}/register?ref=${data.code}`;

  const copy = (v, k) => {
    navigator.clipboard?.writeText(v);
    setCopied(k);
    setTimeout(() => setCopied(''), 1800);
  };

  const totalCommission = Number(data.total_commission || 0);
  const referralCount = data.referral_count ?? data.referrals?.length ?? 0;
  const activeCount = data.active_referrals_count ?? data.referrals?.filter((r) => Number(r.active_package_amount || 0) > 0).length ?? 0;
  const commissions = data.commissions || [];

  return (
    <div className="space-y-6">
      {/* Top Program Banner & Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-500/15 via-green-500/5 to-transparent p-4 sm:p-5">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Commission</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-green-500/20 text-green-400">
              <Coins className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 font-mono text-2xl sm:text-3xl font-extrabold text-green-400">
            {usd(totalCommission)}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-green-300/80">
            <Sparkles className="h-3 w-3" /> 10% instant cash reward
          </div>
        </div>

        <div className="card p-4 sm:p-5">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Network Size</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-white/5 text-zinc-300">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 font-mono text-2xl sm:text-3xl font-extrabold text-white">
            {referralCount}
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">Registered with your code</div>
        </div>

        <div className="card p-4 sm:p-5">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Packages</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-white/5 text-zinc-300">
              <Award className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 font-mono text-2xl sm:text-3xl font-extrabold text-white">
            {activeCount}
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">Referrals actively investing</div>
        </div>

        <div className="card p-4 sm:p-5">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Commission Rate</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-white/5 text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 font-mono text-2xl sm:text-3xl font-extrabold text-emerald-400">
            10.0%
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">On every package activation</div>
        </div>
      </div>

      {/* Invite Code & Link Card */}
      <Card
        title="Referral & Bonus Program"
        subtitle="Invite friends and network partners. When they activate an investment package, 10% of their package amount is instantly credited to your available cash balance."
        icon={Gift}
      >
        <div className="grid gap-4 md:grid-cols-[auto_1fr]">
          <div className="rounded-xl border border-green-500/25 bg-green-500/10 p-4 text-center">
            <div className="text-[10px] tracking-wider text-zinc-400 uppercase font-semibold">Your Referral Code</div>
            <button
              onClick={() => copy(data.code, 'code')}
              className="mt-1 flex items-center justify-center gap-2 font-mono text-2xl font-bold text-green-400 hover:text-green-300 transition"
              title="Click to copy code"
            >
              {data.code} {copied === 'code' ? <Check className="h-4 w-4 text-green-300" /> : <Copy className="h-4 w-4 text-zinc-500" />}
            </button>
          </div>
          <div>
            <span className="label">Personal Invite Link</span>
            <div className="flex gap-2">
              <input className="input font-mono text-xs" readOnly value={link} onFocus={(e) => e.target.select()} />
              <button onClick={() => copy(link, 'link')} className="btn btn-primary shrink-0">
                {copied === 'link' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{' '}
                {copied === 'link' ? 'Copied' : 'Copy Link'}
              </button>
            </div>
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
              New users registered through this link will be automatically linked to your account. You will receive an instant 10% commission payout the moment they activate Package 1 ($250), Package 2 ($500), or Package 3 ($1,000).
            </p>
          </div>
        </div>
      </Card>

      {/* Invited People Table */}
      <Card title={`People you invited (${referralCount})`} icon={Users}>
        {data.referrals.length === 0 ? (
          <Empty icon={Users} title="No invitations yet" text="When someone signs up with your link, they'll appear here." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Joined</th>
                  <th>KYC Status</th>
                  <th>Activated Package</th>
                  <th className="text-right">10% Bonus Earned</th>
                </tr>
              </thead>
              <tbody>
                {data.referrals.map((r) => {
                  const hasPackage = Number(r.active_package_amount || 0) > 0;
                  const comm = Number(r.commission_earned || 0);
                  return (
                    <tr key={r.id || r.username}>
                      <td className="font-semibold text-white">@{r.username}</td>
                      <td className="text-zinc-400">{date(r.created_at)}</td>
                      <td>{r.verified ? <Badge tone="green">Verified</Badge> : <Badge>Registered</Badge>}</td>
                      <td>
                        {hasPackage ? (
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-xs font-semibold text-green-400">
                            <Award className="h-3.5 w-3.5" />
                            {r.active_package_name} ({usd(r.active_package_amount)})
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-500 italic">No package yet</span>
                        )}
                      </td>
                      <td className="text-right font-mono font-semibold">
                        {comm > 0 ? (
                          <span className="text-emerald-400 font-bold">+{usd(comm)}</span>
                        ) : (
                          <span className="text-zinc-600">$0.00</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Commission History Table (when available) */}
      {commissions.length > 0 && (
        <Card title={`Commission Payout History (${commissions.length})`} icon={Coins}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Referral</th>
                  <th>Package Activated</th>
                  <th>Commission Rate</th>
                  <th>Bonus Credited</th>
                  <th>Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((c) => (
                  <tr key={c.id}>
                    <td className="font-semibold text-white">@{c.from_username}</td>
                    <td className="text-zinc-300">
                      {c.package_name} <span className="text-xs text-zinc-500">({usd(c.package_amount)})</span>
                    </td>
                    <td>
                      <Badge tone="green">{Number(c.commission_rate || 10).toFixed(1)}%</Badge>
                    </td>
                    <td className="font-mono font-bold text-green-400">+{usd(c.commission_amount)}</td>
                    <td className="text-xs text-zinc-400">{dateTime(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
