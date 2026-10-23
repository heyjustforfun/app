import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calculator as CalcIcon, Coins, TrendingUp, Zap } from 'lucide-react';
import { Reveal, SectionHeading } from '../components/ui';
import { DASHBOARD_URL, usd } from '../lib/api';

const PRESETS = [
  {
    id: 'free',
    label: 'Daily Tasks Only (Free)',
    dailyTaskEarnings: 4,
    fundDeposit: 0,
    dailyYieldPct: 0,
    m30: 120,
    m90: 360,
    y1: 1460,
  },
  {
    id: 'balanced',
    label: 'Tasks + $500 Balanced Fund',
    dailyTaskEarnings: 4,
    fundDeposit: 500,
    dailyYieldPct: 0.012,
    m30: 210,
    m90: 675,
    y1: 3120,
  },
  {
    id: 'elite',
    label: 'Tasks + $1,000 Elite Fund',
    dailyTaskEarnings: 12,
    fundDeposit: 1000,
    dailyYieldPct: 0.018,
    m30: 540,
    m90: 1840,
    y1: 8950,
  },
];

export default function Calculator() {
  const [selected, setSelected] = useState(PRESETS[1]);

  return (
    <section id="calculator" className="py-24">
      <div className="mx-auto w-full max-w-[1720px] px-4 sm:px-8 lg:px-12 xl:px-16">
        <SectionHeading
          eyebrow="Growth Estimator"
          title="Project Your Monthly Earning Yield"
          subtitle="Calculate your projected returns combining daily task completion with optional fund compounding."
        />

        <Reveal>
          <div className="card overflow-hidden rounded-3xl p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              {PRESETS.map((p) => {
                const active = p.id === selected.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p)}
                    className={`rounded-xl border px-4 py-2.5 text-xs font-semibold transition ${
                      active
                        ? 'border-green-500 bg-green-500 text-ink-950 shadow-lg shadow-green-500/20'
                        : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/5 bg-ink-900/70 p-5 text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-zinc-400">
                  <Coins className="h-4 w-4 text-green-400" /> 30-Day Task Yield
                </div>
                <div className="mt-2 font-mono text-3xl font-extrabold text-white">
                  {usd(selected.m30, 0)}
                </div>
                <div className="mt-1 text-[11px] text-zinc-500">Based on active daily completions</div>
              </div>

              <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-5 text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-green-300">
                  <TrendingUp className="h-4 w-4 text-green-400" /> 90-Day Compounded
                </div>
                <div className="mt-2 font-mono text-3xl font-extrabold text-green-400">
                  {usd(selected.m90, 0)}
                </div>
                <div className="mt-1 text-[11px] text-green-500/80">With automated reinvestment</div>
              </div>

              <div className="rounded-2xl border border-white/5 bg-ink-900/70 p-5 text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-zinc-400">
                  <Zap className="h-4 w-4 text-green-400" /> 1-Year Projection
                </div>
                <div className="mt-2 font-mono text-3xl font-extrabold text-white">
                  {usd(selected.y1, 0)}
                </div>
                <div className="mt-1 text-[11px] text-zinc-500">Compounded annualized run-rate</div>
              </div>
            </div>

            <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-xl border border-white/5 bg-ink-900/40 p-4 text-xs text-zinc-400 sm:flex-row">
              <p>
                Calculations assume consistent task execution and historical validation consensus yield performance.
              </p>
              <a href={`${DASHBOARD_URL}/register`} className="btn-primary shrink-0 text-xs">
                Start Validating Now
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
