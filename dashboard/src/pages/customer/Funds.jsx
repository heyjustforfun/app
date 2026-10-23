import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Info, LineChart, PieChart } from 'lucide-react';
import { useApi, useAuth, useToast } from '../../context/AppContext';
import { RISK, api, date, navFmt, pct, units as fmtUnits, usd } from '../../lib/api';
import { Badge, Empty, ErrorBox, Field, Loading, Modal, Spinner, Tabs } from '../../components/ui';
import { TimeChart } from '../../components/charts';

const RANGES = [
  ['30', '1M'],
  ['90', '3M'],
  ['365', '1Y'],
];

export default function Funds() {
  const { data, loading, error, reload } = useApi('/funds');
  const { user } = useAuth();
  const [action, setAction] = useState(null); // { type: 'invest'|'redeem', fund }

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Investment Packages</h2>
          <p className="text-sm text-zinc-400">
            Activate your trading package to qualify for daily trade tasks and earn 1.00% daily profit in 2 tasks (0.50% per task). Available cash:{' '}
            <b className="font-mono text-green-400">{usd(user.cash_balance)}</b>
          </p>
        </div>
        <Link to="/deposit" className="btn btn-primary btn-sm">
          Deposit Funds
        </Link>
      </div>

      {data.funds.length === 0 && <Empty title="No funds available yet" text="Please check back soon." />}

      {data.funds.map((f, i) => (
        <FundCard key={f.id} fund={f} index={i} onInvest={() => setAction({ type: 'invest', fund: f })} onRedeem={() => setAction({ type: 'redeem', fund: f })} />
      ))}

      <p className="flex items-start gap-2 text-xs text-zinc-600">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Fund values can fall as well as rise. Past performance is not a reliable indicator of future results.
      </p>

      <TradeModal action={action} onClose={() => setAction(null)} onDone={reload} />
    </div>
  );
}

function FundCard({ fund: f, index, onInvest, onRedeem }) {
  const [range, setRange] = useState('90');
  const p = f.performance || {};
  const series = f.history.slice(-Number(range)).map((h) => ({ date: h.as_of, value: h.nav }));
  const held = f.holding.units > 0;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }} className="card overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[1fr_1.4fr]">
        <div className="border-b border-white/5 p-6 lg:border-r lg:border-b-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-white">{f.name}</h3>
            <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${RISK[f.risk_level].cls}`}>{RISK[f.risk_level].label}</span>
            {f.status === 'closed' && <Badge tone="zinc">Closed to new investment</Badge>}
          </div>
          <p className="mt-1 text-sm text-zinc-400">{f.tagline}</p>
          {f.description && <p className="mt-3 text-sm leading-relaxed text-zinc-500">{f.description}</p>}

          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            {[
              ['NAV / unit', navFmt(f.current_nav)],
              ['Since launch', pct(p.since_inception)],
              ['Min. initial', usd(f.min_investment, 0)],
              ['Mgmt. fee', `${Number(f.management_fee_pct).toFixed(2)}% p.a.`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-white/5 bg-ink-900 p-3">
                <dt className="text-[10px] tracking-wider text-zinc-500 uppercase">{k}</dt>
                <dd className="mt-0.5 font-mono font-semibold text-white">{v}</dd>
              </div>
            ))}
          </dl>

          {held && (
            <div className="mt-4 rounded-xl border border-green-500/20 bg-green-500/5 p-3 text-sm">
              <div className="flex items-center gap-2 text-xs font-semibold text-green-400">
                <PieChart className="h-3.5 w-3.5" /> Your holding
              </div>
              <div className="mt-1 flex justify-between font-mono">
                <span className="text-zinc-400">{fmtUnits(f.holding.units)} units</span>
                <span className="font-bold text-white">{usd(f.holding.value)}</span>
              </div>
            </div>
          )}

          <div className="mt-5 flex gap-2">
            <button className="btn btn-primary flex-1" onClick={onInvest} disabled={f.status !== 'open'}>
              {held ? 'Add Investment' : 'Activate Package'}
            </button>
            <button className="btn btn-ghost flex-1" onClick={onRedeem} disabled={!held}>
              Redeem
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <LineChart className="h-4 w-4 text-green-400" /> NAV history
            </div>
            <Tabs tabs={RANGES} value={range} onChange={setRange} />
          </div>
          {series.length > 1 ? (
            <TimeChart data={series} height={240} format={(v) => Number(v).toFixed(4)} valueLabel="NAV" />
          ) : (
            <div className="grid h-60 place-items-center rounded-xl border border-dashed border-white/10 text-sm text-zinc-600">
              History will appear as daily NAVs are published{p.inception_date ? ` (launched ${date(p.inception_date)})` : ''}.
            </div>
          )}
          <div className="mt-3 flex gap-4 font-mono text-xs text-zinc-500">
            <span>30D {pct(p.d30)}</span>
            <span>1Y {pct(p.y1)}</span>
            {f.strategy && <span className="font-sans">Strategy: {f.strategy}</span>}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function TradeModal({ action, onClose, onDone }) {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const f = action?.fund;
  const invest = action?.type === 'invest';

  const close = () => {
    setAmount('');
    setAll(false);
    onClose();
  };

  const amt = Number(amount) || 0;
  const nav = f ? Number(f.current_nav) : 1;
  const estUnits = all ? f?.holding.units : amt / nav;
  const firstMin = invest && f && f.holding.units <= 0 ? Number(f.min_investment) : 0;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (invest) {
        const r = await api(`/funds/${f.id}/invest`, { method: 'POST', body: { amount: amt } });
        toast.success(`Invested ${usd(amt)}: ${fmtUnits(r.units)} units of ${f.name}`);
      } else {
        const r = await api(`/funds/${f.id}/redeem`, { method: 'POST', body: all ? { all: true } : { amount: amt } });
        toast.success(`Redeemed ${fmtUnits(r.units)} units. ${usd(r.proceeds)} added to your cash.`);
      }
      await refresh();
      onDone();
      close();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!action} onClose={close} title={f ? `${invest ? 'Invest in' : 'Redeem from'} ${f.name}` : ''}>
      {f && (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-white/5 bg-ink-900 p-3">
              <div className="text-[10px] text-zinc-500 uppercase">Current NAV</div>
              <div className="font-mono font-semibold text-white">{nav.toFixed(6)}</div>
            </div>
            <div className="rounded-xl border border-white/5 bg-ink-900 p-3">
              <div className="text-[10px] text-zinc-500 uppercase">{invest ? 'Available cash' : 'Your holding'}</div>
              <div className="font-mono font-semibold text-green-400">{invest ? usd(user.cash_balance) : usd(f.holding.value)}</div>
            </div>
          </div>

          {!invest && (
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" className="accent-green-500" checked={all} onChange={(e) => setAll(e.target.checked)} /> Redeem my entire holding
            </label>
          )}

          {!all && (
            <Field label="Amount (USD)" hint={firstMin ? `Minimum initial investment: ${usd(firstMin, 0)}` : undefined}>
              <input className="input font-mono" type="number" min="0.01" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
            </Field>
          )}

          <div className="rounded-xl border border-white/5 bg-ink-900 p-3 text-sm text-zinc-400">
            {invest ? 'You will receive approximately ' : 'You will sell approximately '}
            <b className="font-mono text-white">{fmtUnits(estUnits || 0)}</b> units at NAV {nav.toFixed(4)}.
            {!invest && (
              <>
                {' '}
                Proceeds go to your available cash: <b className="font-mono text-green-400">{usd(all ? f.holding.value : amt)}</b>.
              </>
            )}
          </div>

          <button className="btn btn-primary w-full" disabled={busy || (!all && amt <= 0)}>
            {busy && <Spinner className="!text-ink-950" />} Confirm {invest ? 'Investment' : 'Redemption'}
          </button>
        </form>
      )}
    </Modal>
  );
}
