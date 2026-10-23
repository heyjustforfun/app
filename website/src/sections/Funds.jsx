import { motion } from 'framer-motion';
import { CheckCircle2, Zap } from 'lucide-react';
import { Reveal, SectionHeading } from '../components/ui';
import { DASHBOARD_URL } from '../lib/api';

const PACKAGES = [
  {
    id: 'starter',
    name: 'Basic Starter',
    price: '$250.00',
    unit: '/ allocation',
    yieldTag: '1% Daily Yield: +$2.50 / day',
    featured: false,
    cta: 'Select Basic Starter',
    slug: 'income-fund',
    features: [
      '2 Daily Tasks included (Unlock 3 & 4 tasks via referrals)',
      '1% on daily basis (+$2.50 guaranteed daily yield)',
      '50% Profit Company Received (Treasury liquidity backing & reserve)',
      'Anytime full payment withdrawal (100% liquid balance)',
      '20% instant bonus (+$50.00 on any referral)',
      '24/7 priority support & live 1-on-1 messenger',
      'Strict 1-Person-1-ID fraud & capital protection',
      'Zero hidden fees & fast bank wire payout',
    ],
  },
  {
    id: 'growth',
    name: 'Standard Growth',
    price: '$500.00',
    unit: '/ allocation',
    yieldTag: '1% Daily Yield: +$5.00 / day',
    featured: true,
    cta: 'Select Standard Growth',
    slug: 'balanced-growth-fund',
    features: [
      '2 Daily Tasks included (Unlock 3 & 4 tasks via referrals)',
      '1% on daily basis (+$5.00 guaranteed daily yield)',
      '50% Profit Company Received (Treasury liquidity backing & reserve)',
      'Anytime full payment withdrawal (100% liquid balance)',
      '20% instant bonus (+$100.00 on any referral)',
      '24/7 priority support & live 1-on-1 messenger',
      'Strict 1-Person-1-ID fraud & capital protection',
      'Zero hidden fees & fast bank wire payout',
    ],
  },
  {
    id: 'elite',
    name: 'Executive Elite',
    price: '$1000.00',
    unit: '/ allocation',
    yieldTag: '1% Daily Yield: +$10.00 / day',
    featured: false,
    cta: 'Select Executive Elite',
    slug: 'global-equity-fund',
    features: [
      '2 Daily Tasks included (Unlock 3 & 4 tasks via referrals)',
      '1% on daily basis (+$10.00 guaranteed daily yield)',
      '50% Profit Company Received (Treasury liquidity backing & reserve)',
      'Anytime full payment withdrawal (100% liquid balance)',
      '20% instant bonus (+$200.00 on any referral)',
      '24/7 priority support & live 1-on-1 messenger',
      'Strict 1-Person-1-ID fraud & capital protection',
      'Zero hidden fees & fast bank wire payout',
    ],
  },
];

export default function Funds() {
  return (
    <section id="packages" className="relative py-24 scroll-mt-20">
      <div id="funds" className="pointer-events-none absolute -top-20" />
      <div className="pointer-events-none absolute top-1/3 left-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-green-500/5 blur-[120px]" />
      
      <div className="mx-auto w-full max-w-[1720px] px-4 sm:px-8 lg:px-12 xl:px-16">
        <SectionHeading
          eyebrow="TRANSPARENT TIERS"
          title="Available Investment Packages"
          subtitle="Activate your preferred tier to unlock immediate daily tasks and commission eligibility."
        />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:gap-8 items-stretch">
          {PACKAGES.map((pkg, i) => (
            <Reveal key={pkg.id} delay={i * 0.1}>
              <motion.div
                whileHover={{ y: -6 }}
                className={`card relative flex h-full flex-col justify-between rounded-3xl p-6 sm:p-8 backdrop-blur transition-all ${
                  pkg.featured
                    ? '!border-2 !border-green-500 shadow-[0_0_60px_-15px_rgba(34,197,94,0.35)] bg-ink-850/95'
                    : 'border-white/5 bg-ink-850/80 hover:border-white/10'
                }`}
              >
                {pkg.featured && (
                  <span className="absolute -top-3.5 right-6 sm:right-8 rounded-full bg-green-500 px-3.5 py-1 text-[10px] font-extrabold tracking-wider text-ink-950 uppercase shadow-lg shadow-green-500/30">
                    RECOMMENDED
                  </span>
                )}

                <div>
                  {/* Tier Title */}
                  <h3 className="text-xl font-bold text-white">{pkg.name}</h3>

                  {/* Price */}
                  <div className="mt-4 flex items-baseline gap-1.5">
                    <span className="font-mono text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
                      {pkg.price}
                    </span>
                    <span className="text-xs text-zinc-500 font-normal">{pkg.unit}</span>
                  </div>

                  {/* Yield Tag */}
                  <div className="mt-4 flex items-center justify-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs font-semibold text-green-400">
                    <Zap className="h-3.5 w-3.5 fill-current text-green-400" />
                    <span>{pkg.yieldTag}</span>
                  </div>

                  {/* Checklist Features */}
                  <ul className="mt-6 space-y-3 text-xs sm:text-sm text-zinc-300">
                    {pkg.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                        <span className="leading-relaxed">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Call-to-Action Button */}
                <a
                  href={`${DASHBOARD_URL}/register?package=${pkg.id}`}
                  className={`mt-8 flex w-full items-center justify-center rounded-xl py-3 text-sm font-semibold transition ${
                    pkg.featured
                      ? 'bg-green-500 font-bold text-ink-950 hover:bg-green-400 shadow-[0_0_30px_-5px_rgba(34,197,94,0.6)]'
                      : 'border border-white/10 bg-white/[0.03] text-zinc-300 hover:border-green-500/40 hover:bg-green-500/10 hover:text-white'
                  }`}
                >
                  {pkg.cta}
                </a>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
