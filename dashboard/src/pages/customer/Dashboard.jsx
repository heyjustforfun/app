import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, ArrowDownLeft, BadgeCheck, CheckSquare, Layers, PieChart, TrendingUp, Wallet, Zap } from 'lucide-react';
import { useApi, useAuth } from '../../context/AppContext';
import { RISK, navFmt, pct, units, usd } from '../../lib/api';
import { Badge, Card, Empty, ErrorBox, Loading, StatCard } from '../../components/ui';
import { TimeChart } from '../../components/charts';
import TxTable from '../../components/TxTable';

export default function Dashboard() {
  const { data, loading, error, reload } = useApi('/me/overview');
  const { setUser } = useAuth();

  useEffect(() => {
    if (data?.user) setUser(data.user);
  }, [data, setUser]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const { user, totals, holdings, recent, history } = data;
  const returnPct = totals.cost_basis > 0 ? (totals.pnl / totals.cost_basis) * 100 : null;

  let banner;
  if (user.kyc_status !== 'verified' && user.kyc_status !== 'pending') {
    banner = { text: 'Verify your identity to enable withdrawals and keep your account secure.', cta: 'Verify Identity', to: '/profile', icon: BadgeCheck };
  } else if (totals.cash === 0 && holdings.length === 0) {
    banner = { text: 'Make your first deposit by bank wire, then choose a fund to invest in.', cta: 'Deposit Funds', to: '/deposit', icon: Zap };
  } else if (totals.cash > 0 && holdings.length === 0) {
    banner = { text: `You have ${usd(totals.cash)} available. Choose an investment package to start daily trade tasks.`, cta: 'Choose a Package', to: '/packages', icon: Zap };
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-green-500/10 text-green-400">
            {banner ? <banner.icon className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
          </span>
          <div>
            <div className="font-semibold text-white">Welcome back, @{user.username}!</div>
            <div className="text-sm text-zinc-500">{banner ? banner.text : 'Here is how your portfolio is doing today.'}</div>
          </div>
        </div>
        {banner && (
          <Link to={banner.to} className="btn btn-primary btn-sm !px-4 !py-2">
            {banner.cta}
          </Link>
        )}
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} label="Available cash" value={usd(totals.cash)} valueClass="text-green-400" icon={Wallet} tone="green" hint={<><Badge tone="green">Wallet</Badge> <span className="ml-1">Ready to invest or withdraw</span></>} />
        <StatCard index={1} label="Portfolio value" value={usd(totals.portfolio)} icon={PieChart} tone="blue" hint={`${holdings.length} fund${holdings.length === 1 ? '' : 's'} at latest NAV`} />
        <StatCard
          index={2}
          label="Total return"
          value={`${totals.pnl >= 0 ? '+' : '−'}${usd(Math.abs(totals.pnl))}`}
          valueClass={totals.pnl >= 0 ? 'text-amber-400' : 'text-rose-400'}
          icon={TrendingUp}
          tone="amber"
          hint={returnPct == null ? 'Unrealised gain on current holdings' : `${pct(returnPct)} on ${usd(totals.cost_basis)} invested`}
        />
        <StatCard
          index={3}
          label="Total withdrawn"
          value={usd(totals.withdrawn)}
          icon={ArrowDownLeft}
          hint={totals.pending_withdrawals > 0 ? `${usd(totals.pending_withdrawals)} being processed` : 'Paid to your bank account'}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card flex flex-wrap items-center justify-between gap-4 border-amber-500/20 bg-gradient-to-r from-ink-900 via-amber-500/5 to-ink-900 p-4"
      >
        <div className="flex items-center gap-3.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-400">
            <CheckSquare className="h-5 w-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">Daily Investor Tasks</span>
              <Badge tone="amber">Earn Rewards</Badge>
            </div>
            <div className="text-xs text-zinc-400">
              Complete today's daily activities to earn instant cash bonuses credited directly to your wallet.
            </div>
          </div>
        </div>
        <Link to="/tasks" className="btn btn-primary btn-sm !px-4 !py-2">
          View Daily Tasks &rarr;
        </Link>
      </motion.div>

      <Card title="Portfolio Value" subtitle="Daily value of your fund holdings over the last 90 days" icon={Activity}>
        {history.length > 1 ? (
          <TimeChart data={history} format={(v) => usd(v, 0)} valueLabel="Portfolio" />
        ) : (
          <Empty icon={Layers} title="No active trading package" text="Once you activate an investment package, its performance will be tracked here.">
            <Link to="/packages" className="btn btn-primary">
              Browse Packages
            </Link>
          </Empty>
        )}
      </Card>

      {holdings.length > 0 && (
        <Card title="Your Active Packages" subtitle="Activated investment packages qualifying for daily trading tasks" icon={PieChart} actions={<Link to="/packages" className="btn btn-ghost btn-sm">Manage Packages</Link>}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Package</th>
                  <th className="text-right">Units</th>
                  <th className="text-right">NAV</th>
                  <th className="text-right">Invested</th>
                  <th className="text-right">Value</th>
                  <th className="text-right">Return</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => (
                  <tr key={h.fund_id}>
                    <td>
                      <div className="font-semibold text-white">{h.name}</div>
                      <span className={`mt-1 inline-block rounded border px-1.5 text-[10px] ${RISK[h.risk_level].cls}`}>{RISK[h.risk_level].label}</span>
                    </td>
                    <td className="text-right font-mono">{units(h.units)}</td>
                    <td className="text-right font-mono">{navFmt(h.current_nav)}</td>
                    <td className="text-right font-mono">{usd(h.invested)}</td>
                    <td className="text-right font-mono font-semibold text-white">{usd(h.value)}</td>
                    <td className={`text-right font-mono ${h.pnl >= 0 ? 'text-green-400' : 'text-rose-400'}`}>
                      {h.pnl >= 0 ? '+' : '−'}
                      {usd(Math.abs(h.pnl))}
                      <div className="text-[11px]">{h.invested > 0 ? pct((h.pnl / h.invested) * 100) : ''}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card
        title="Recent Wallet Ledger"
        subtitle="Transparent record of deposits, trade profits, adjustments and withdrawals"
      >
        <TxTable rows={recent} empty="No wallet transactions recorded yet." />
      </Card>
    </div>
  );
}
