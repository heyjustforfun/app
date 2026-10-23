import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  Coins,
  Globe,
  Landmark,
  LineChart,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Counter } from '../components/ui';
import { DASHBOARD_URL, compactUsd, navFmt, pct, riskColor, riskLabel, usd } from '../lib/api';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.12 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.21, 0.6, 0.35, 1] } } };

export default function Hero({ funds, stats }) {
  return (
    <section id="home" className="relative pt-10 pb-20 sm:pt-16">
      <div className="grid-bg pointer-events-none absolute inset-0 -z-10" />
      <motion.div
        className="pointer-events-none absolute -top-40 left-1/4 -z-10 h-[500px] w-[500px] rounded-full bg-green-500/10 blur-[120px]"
        animate={{ x: [0, 60, 0], y: [0, 40, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="pointer-events-none absolute top-40 right-0 -z-10 h-[400px] w-[400px] rounded-full bg-lime-400/5 blur-[120px]"
        animate={{ x: [0, -50, 0], y: [0, -30, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="mx-auto grid w-full max-w-[1720px] items-center gap-12 px-4 sm:px-8 lg:px-12 xl:px-16 lg:grid-cols-[1.1fr_1fr]">
        <motion.div variants={container} initial="hidden" animate="show">
          <motion.span
            variants={item}
            className="inline-flex items-center gap-2 rounded-full border border-green-500/25 bg-green-500/10 px-3.5 py-1 text-[11px] font-semibold tracking-wider text-green-400 uppercase"
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Institutional Decentralized Yield
          </motion.span>
          <motion.h1 variants={item} className="mt-6 text-4xl leading-[1.08] font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Institutional Liquidity <span className="text-gradient">Consensus & 1% Daily</span> Yield Validation
          </motion.h1>
          <motion.p variants={item} className="mt-6 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            Earn consistent, risk-adjusted yields from decentralized automated consensus liquidity validation. Backed by real-world treasury assets with daily NAV settlement and zero lockup friction.
          </motion.p>
          <motion.ul variants={item} className="mt-6 space-y-2.5 text-sm">
            {[
              ['Includes 2 Base Daily Tasks', '(Earn $1.50 - $2.50 each) with 1-Click Verification'],
              ['Direct Automated Settlement', 'to your USD Wallet with Instant Withdrawal'],
              ['Tiered Referral System:', 'Invite 3 Friends to Unlock 3 Tasks, 5 to Unlock 4 Tasks'],
            ].map(([b, t]) => (
              <li key={b} className="flex gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                <span>
                  <b className="font-semibold text-white">{b}</b> <span className="text-zinc-400">{t}</span>
                </span>
              </li>
            ))}
          </motion.ul>
          <motion.div variants={item} className="mt-8 flex flex-wrap gap-3">
            <a href={`${DASHBOARD_URL}/register`} className="btn-primary">
              Start Daily Tasks (Free) <ArrowRight className="h-4 w-4" />
            </a>
            <a href="#funds" className="btn-ghost">
              <LineChart className="h-4 w-4" /> View Investment Packages
            </a>
          </motion.div>
        </motion.div>

        <motion.div id="trade" className="scroll-mt-28" initial={{ opacity: 0, y: 40, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.8, delay: 0.3 }}>
          <FundTerminal funds={funds} />
        </motion.div>
      </div>

      <div className="mx-auto mt-16 grid w-full max-w-[1720px] grid-cols-2 gap-4 px-4 sm:px-8 lg:px-12 xl:px-16 lg:grid-cols-4">
        {[
          { icon: Zap, value: '1.8% / Day', label: 'Target Validation Yield' },
          { icon: Landmark, value: stats.aum ? <Counter value={stats.aum} format={compactUsd} /> : '$14.8M+', label: 'AUM Treasury Backed' },
          { icon: Globe, value: stats.members ? `${stats.members.toLocaleString()}+ Users` : '28.9K Users', label: 'Active Daily Validations' },
          { icon: BadgeCheck, value: '1-Person : 1-ID', label: 'Strict KYC & Fraud Mitigation' },
        ].map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            whileHover={{ y: -4 }}
            className="card group p-5"
          >
            <s.icon className="mb-3 h-5 w-5 text-green-400 transition group-hover:scale-110" />
            <div className="font-mono text-xl font-bold text-white sm:text-2xl">{s.value}</div>
            <div className="mt-1 text-xs text-zinc-500">{s.label}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function FundTerminal({ funds }) {
  const [idx, setIdx] = useState(0);
  const fund = funds[idx];

  const base = Number(fund?.current_nav) || 100000;

  // Live real-time trade ticker states
  const [livePrice, setLivePrice] = useState(base);
  const [direction, setDirection] = useState('up'); // 'up' | 'down'
  const [changePct, setChangePct] = useState(0.0);
  const [lastDelta, setLastDelta] = useState(0);
  const [bars, setBars] = useState([]);
  const [tickKey, setTickKey] = useState(0);

  // Initialize bars & price when fund changes
  useEffect(() => {
    const curBase = Number(fund?.current_nav) || 100000;
    const initialBars = Array.from({ length: 24 }, (_, i) => {
      const progress = i / 23;
      const wave = Math.sin(i * 0.7) * 0.008 + (i % 3 === 0 ? 0.003 : -0.002);
      return Number((curBase * (0.985 + progress * 0.015 + wave)).toFixed(2));
    });
    setBars(initialBars);
    setLivePrice(curBase);
    setDirection('up');
    setChangePct(0.0);
    setLastDelta(0);
  }, [fund?.id, fund?.current_nav]);

  // Live real-time trading price simulation
  useEffect(() => {
    const curBase = Number(fund?.current_nav) || 100000;
    const vol = idx === 0 ? 120 : idx === 1 ? 280 : 450;

    const interval = setInterval(() => {
      // 53% chance up, 47% chance down for natural trading oscillations
      const isUp = Math.random() > 0.47;
      const step = (Math.random() * 0.75 + 0.25) * vol;
      const delta = isUp ? step : -step;

      setLivePrice((current) => {
        const minBound = curBase * 0.985;
        const maxBound = curBase * 1.018;
        let next = current + delta;
        if (next < minBound) next = minBound + Math.random() * vol;
        if (next > maxBound) next = maxBound - Math.random() * vol;

        const dir = next >= current ? 'up' : 'down';
        const pctDiff = ((next - curBase) / curBase) * 100;

        setDirection(dir);
        setChangePct(pctDiff);
        setLastDelta(next - current);
        setTickKey((k) => k + 1);

        setBars((prevBars) => {
          const updated = [...prevBars.slice(1), Number(next.toFixed(2))];
          return updated;
        });

        return Number(next.toFixed(2));
      });
    }, 1800);

    return () => clearInterval(interval);
  }, [fund?.id, fund?.current_nav, idx]);

  const bMin = bars.length > 0 ? Math.min(...bars) : base * 0.98;
  const bMax = bars.length > 0 ? Math.max(...bars) : base * 1.02;
  const bSpan = bMax - bMin > 0 ? bMax - bMin : 1;

  return (
    <div className="relative w-full">
      <div className="absolute -inset-px -z-10 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-green-500/40 via-transparent to-green-500/10 blur-sm" />
      <div className="card rounded-2xl sm:rounded-3xl !bg-ink-850/95 p-3.5 sm:p-6 shadow-2xl shadow-black/50 backdrop-blur w-full overflow-hidden">
        {/* Header with Live Status & Order Execution badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-semibold tracking-wider text-zinc-300 uppercase min-w-0">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                direction === 'up'
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,1)]'
                  : 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,1)]'
              } animate-pulse`}
            />
            <span className="truncate">
              LIVE NAV CAPITAL FLOWS<span className="hidden sm:inline"> · ACTIVE POOL</span>
            </span>
          </div>
          <span
            className={`shrink-0 rounded-md border px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold transition-colors duration-300 flex items-center gap-1.5 whitespace-nowrap ${
              direction === 'up'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${direction === 'up' ? 'bg-emerald-400' : 'bg-rose-400'} animate-ping`} />
            <span>{direction === 'up' ? 'BUY FLOW +ACTIVE' : 'SELL DIP -HEDGED'}</span>
          </span>
        </div>

        {/* Fund Tabs */}
        <div className="mt-3 sm:mt-4 flex overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap gap-1.5 sm:gap-2 scrollbar-none">
          {funds.map((f, i) => (
            <button
              key={f.id}
              onClick={() => setIdx(i)}
              className={`shrink-0 rounded-lg border px-2.5 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-medium transition ${
                i === idx
                  ? 'border-green-500 bg-green-500 text-ink-950 font-semibold shadow-[0_0_12px_rgba(34,197,94,0.3)]'
                  : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-white'
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>

        {/* Live Trade Ticker View */}
        <div className="mt-4 sm:mt-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] tracking-wider text-zinc-500 uppercase min-w-0">
              <span className="truncate text-zinc-400">{fund ? `${fund.name} · Unit NAV` : 'Income Fund · Unit NAV'}</span>
              <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-zinc-400">REAL-TIME</span>
            </div>
            {fund && (
              <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold ${riskColor[fund.risk_level]}`}>
                {riskLabel[fund.risk_level]}
              </span>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-baseline gap-2 sm:gap-3">
            <motion.span
              key={tickKey}
              initial={{ opacity: 0.85, y: direction === 'up' ? -2 : 2 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`font-mono text-2xl sm:text-4xl font-extrabold tracking-tight transition-colors duration-300 ${
                direction === 'up'
                  ? 'text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.3)]'
                  : 'text-rose-400 drop-shadow-[0_0_12px_rgba(251,113,133,0.3)]'
              }`}
            >
              {Number(livePrice).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
            </motion.span>
            <motion.span
              key={`pct-${tickKey}`}
              initial={{ scale: 0.92, opacity: 0.8 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
              className={`inline-flex items-center gap-1 font-mono text-xs sm:text-sm font-bold px-2 py-0.5 rounded-md border transition-all duration-300 ${
                changePct >= 0
                  ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30 shadow-[0_0_10px_rgba(52,211,153,0.15)]'
                  : 'text-rose-400 bg-rose-500/15 border-rose-500/30 shadow-[0_0_10px_rgba(251,113,133,0.15)]'
              }`}
            >
              {changePct >= 0 ? <TrendingUp className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : <TrendingDown className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
              {changePct >= 0 ? `+${changePct.toFixed(2)}%` : `${changePct.toFixed(2)}%`}
            </motion.span>
          </div>
        </div>

        {/* Micro-telemetry spread and high/low */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-y-1 gap-x-2 text-[10px] font-mono text-zinc-400 border-t border-b border-white/[0.04] py-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9.5px] sm:text-[10px]">
            <span className="inline-flex items-center gap-1">
              <span className="text-zinc-500">SPREAD:</span> 0.0002
            </span>
            <span className="text-zinc-700">|</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-zinc-500">24H HIGH:</span>{' '}
              {Number(base * 1.014).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="hidden sm:inline text-zinc-700">|</span>
            <span className="hidden sm:inline-flex items-center gap-1">
              <span className="text-zinc-500">24H LOW:</span>{' '}
              {Number(base * 0.988).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <span className={`ml-auto font-semibold flex items-center gap-0.5 shrink-0 transition-colors duration-300 text-[10px] ${direction === 'up' ? 'text-emerald-400' : 'text-rose-400'}`}>
            {direction === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {lastDelta >= 0 ? `+$${Math.abs(lastDelta).toFixed(2)}` : `-$${Math.abs(lastDelta).toFixed(2)}`}
          </span>
        </div>

        {/* Live dynamic responsive bar chart with up/down color changes */}
        <div className="mt-3 relative w-full h-24 sm:h-28 overflow-hidden rounded-xl border border-white/5 bg-ink-900/60 p-2 sm:p-3 flex items-end gap-1 sm:gap-1.5">
          {bars.map((v, i, arr) => {
            const isLast = i === arr.length - 1;
            const isBarUp = i === 0 ? true : v >= arr[i - 1];
            const pctHeight = Math.min(95, Math.max(18, Math.round(20 + ((v - bMin) / bSpan) * 75)));
            return (
              <div
                key={i}
                style={{ height: `${pctHeight}%` }}
                className={`flex-1 min-w-[2px] rounded-t transition-all duration-300 ${
                  isLast
                    ? direction === 'up'
                      ? 'bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,1)]'
                      : 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,1)]'
                    : isBarUp
                    ? 'bg-emerald-500/35 hover:bg-emerald-500/60'
                    : 'bg-rose-500/35 hover:bg-rose-500/60'
                }`}
              />
            );
          })}
        </div>

        {/* Earned today from tasks banner */}
        <div className="mt-3 sm:mt-4 flex items-center justify-between rounded-xl border border-green-500/25 bg-green-500/10 px-3 py-2 sm:py-2.5">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <Coins className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-400 shrink-0" />
            <span className="text-[11px] sm:text-xs font-semibold text-zinc-200 truncate">EARNED TODAY FROM TASKS:</span>
          </div>
          <span className="font-mono text-xs sm:text-sm font-bold text-green-400 shrink-0 ml-2">$4.00 USD</span>
        </div>

        {/* Three stat pills */}
        <div className="mt-2.5 sm:mt-3 grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
          {[
            ['Min. investment', fund ? usd(fund.min_investment, 0) : '$250'],
            ['Mgmt. fee', fund ? `${Number(fund.management_fee_pct).toFixed(2)}%` : '0.00%'],
            ['30-day Yield', pct(fund?.performance?.d30 ?? 0.054)],
          ].map(([l, v]) => (
            <div key={l} className="rounded-xl border border-white/5 bg-ink-900/60 p-2 sm:p-2.5 min-w-0">
              <div className="text-[9px] sm:text-[10px] text-zinc-500 uppercase truncate">{l}</div>
              <div className="mt-0.5 font-mono text-[11px] sm:text-xs font-semibold text-white truncate">{v}</div>
            </div>
          ))}
        </div>

        <a href={`${DASHBOARD_URL}/register`} className="btn-primary mt-3.5 sm:mt-4 w-full justify-center !py-2.5 sm:!py-3 text-xs sm:text-sm">
          Start Daily Task 1 <ChevronRight className="h-4 w-4" />
        </a>
        <p className="mt-2.5 sm:mt-3 text-center text-[9px] sm:text-[10px] text-zinc-600">Automated consensus validation · Direct USD wallet clearance</p>
      </div>
    </div>
  );
}
