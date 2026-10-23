import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Logo, Reveal } from '../components/ui';
import { DASHBOARD_URL } from '../lib/api';

export function Cta() {
  return (
    <section className="py-16">
      <div className="mx-auto w-full max-w-[1720px] px-4 sm:px-8 lg:px-12 xl:px-16">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-green-500/25 bg-gradient-to-br from-green-500/15 via-ink-850 to-ink-900 p-8 sm:p-12">
            <motion.div
              className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-green-500/20 blur-3xl"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 6, repeat: Infinity }}
            />
            <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div>
                <span className="text-[11px] font-semibold tracking-[0.2em] text-green-400 uppercase">
                  Decentralized Automated Consensus
                </span>
                <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-white">
                  Ready to Start Generating 1.00% Daily Profit with Trade Tasks?
                </h2>
                <p className="mt-2 max-w-lg text-sm text-zinc-400">
                  Create your free account today and begin completing your 2 daily 30-second trade sessions in minutes.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a href={`${DASHBOARD_URL}/register`} className="btn-primary">
                  Create Free Account <ArrowRight className="h-4 w-4" />
                </a>
                <a href={`${DASHBOARD_URL}/login`} className="btn-ghost">
                  Sign In
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function Footer({ settings }) {
  const cols = [
    ['Platform', [['Daily Tasks', '#daily-tasks'], ['Investment Packages', '#funds'], ['How It Works', '#how-it-works']]],
    ['Investors', [['Create Account', `${DASHBOARD_URL}/register`], ['Sign In', `${DASHBOARD_URL}/login`], ['Install App', '#app'], ['Support Desk', '#contact']]],
    ['Company', [['About ApexLedger', '#about'], ['Institutional Security', '#features'], ['Contact', '#contact']]],
  ];
  return (
    <footer className="mt-12 border-t border-white/5 bg-ink-950">
      <div className="mx-auto w-full max-w-[1720px] px-4 py-14 sm:px-8 lg:px-12 xl:px-16">
        <div className="grid gap-10 md:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-sm text-sm text-zinc-500">
              Institutional decentralized liquidity consensus, daily task yield validation, and asset-backed treasury portfolios with daily NAV clearance.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/5 px-3 py-2 text-xs text-zinc-400">
              <ShieldCheck className="h-4 w-4 text-green-400" /> Encrypted connection · Audited consensus ledger
            </div>
          </div>
          {cols.map(([title, links]) => (
            <div key={title}>
              <div className="text-xs font-semibold tracking-wider text-white uppercase">{title}</div>
              <ul className="mt-4 space-y-2.5 text-sm">
                {links.map(([l, h]) => (
                  <li key={l}>
                    <a href={h} className="text-zinc-500 transition hover:text-green-400">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-white/5 bg-ink-900 p-5 text-xs leading-relaxed text-zinc-500">
          <b className="text-zinc-300">Risk notice:</b>{' '}
          {settings.regulatory_notice ||
            'Daily task validations and managed investment funds carry risk. Yields are generated based on consensus participation and underlying treasury assets. Past performance is not a guarantee of future returns.'}
        </div>

        <div className="mt-8 flex flex-col justify-between gap-2 border-t border-white/5 pt-6 text-xs text-zinc-600 sm:flex-row">
          <span>
            © {new Date().getFullYear()} {settings.company_name || 'ApexLedger Protocol'}. All rights reserved.
          </span>
          {settings.office_address && <span>{settings.office_address}</span>}
        </div>
      </div>
    </footer>
  );
}
