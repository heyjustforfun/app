import { motion } from 'framer-motion';
import { ArrowRight, Check, Sparkles, Star, Users } from 'lucide-react';
import { Reveal, SectionHeading } from '../components/ui';
import { DASHBOARD_URL } from '../lib/api';

const TIERS = [
  {
    title: '2 Tasks / Day',
    badge: 'DEFAULT TIER · FREE',
    badgeColor: 'border-white/10 bg-white/5 text-zinc-300',
    subtitle: '2 daily verification tasks ($1.50 - $2.50 each)',
    highlight: '~$4.00',
    highlightLabel: 'Daily Base Earnings',
    points: ['No referrals required', 'Instant USD credit to balance', 'Standard review queue', 'Access to all investment pools'],
    cta: 'Included with Free Account',
    href: `${DASHBOARD_URL}/register`,
    featured: false,
  },
  {
    title: '3 Tasks / Day',
    badge: 'TIER 1 · 3 REFERRALS',
    badgeColor: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
    subtitle: '3rd high-yield task ($3.50 extra)',
    highlight: '~$7.50',
    highlightLabel: 'Daily Task Yield',
    points: ['Requires 3 verified friends', 'Higher priority verification', 'Accelerated clearance queue', '1.2x Compound Yield Bonus'],
    cta: 'Invite 3 Friends',
    href: `${DASHBOARD_URL}/login`,
    featured: false,
  },
  {
    title: '4 Tasks / Day',
    badge: 'RECOMMENDED · 5 REFERRALS',
    badgeColor: 'border-green-500/40 bg-green-500/15 text-green-300',
    subtitle: 'Unlock all 4 daily tasks',
    highlight: '~$12.00',
    highlightLabel: 'Daily Task Yield',
    points: ['Requires 5 verified friends', 'Maximum daily task quota', 'Priority VIP clearance', 'Exclusive Weekly Pool Airdrops'],
    cta: 'Invite 5 Friends',
    href: `${DASHBOARD_URL}/login`,
    featured: true,
  },
  {
    title: '5+ Tasks / Day',
    badge: 'PARTNER TIER · 10+ REFS',
    badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    subtitle: 'Exclusive Institutional Tasks',
    highlight: 'Custom Yield',
    highlightLabel: 'Allocation',
    points: ['Requires 10+ active investors', 'Institutional consensus pools', 'Dedicated manager support', 'Direct wire API integration'],
    cta: 'Become a Partner',
    href: '#contact',
    featured: false,
  },
];

export default function TaskTiers() {
  return (
    <section id="tasks" className="relative py-24 scroll-mt-20">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(34,197,94,0.06),transparent_70%)]" />
      <div className="mx-auto w-full max-w-[1720px] px-4 sm:px-8 lg:px-12 xl:px-16">
        <SectionHeading
          eyebrow="Tiered Daily Task System"
          title="Base Plan: 2 Daily Tasks · Refer Friends to Unlock 3 & 4 Daily Tasks"
          subtitle="Every investor receives 2 tasks daily by default. Invite active friends using your referral link to unlock higher task quotas and maximize daily earnings."
        />

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((t, i) => (
            <Reveal key={t.title} delay={i * 0.1}>
              <motion.div
                whileHover={{ y: -6 }}
                className={`card relative flex h-full flex-col p-6 transition-all ${
                  t.featured
                    ? '!border-green-500/60 !bg-gradient-to-b !from-ink-850 !to-ink-900 shadow-[0_0_50px_-15px_rgba(34,197,94,0.4)]'
                    : 'hover:border-white/20'
                }`}
              >
                {t.featured && (
                  <span className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-green-500 px-3 py-1 text-[10px] font-bold tracking-wider text-ink-950 uppercase shadow-lg shadow-green-500/20">
                    <Star className="h-3 w-3 fill-current" /> Most Popular
                  </span>
                )}

                <div className="flex flex-col gap-2">
                  <span className={`inline-block w-fit rounded-md border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${t.badgeColor}`}>
                    {t.badge}
                  </span>
                  <h3 className="text-xl font-bold text-white">{t.title}</h3>
                  <p className="text-xs text-zinc-400">{t.subtitle}</p>
                </div>

                <div className="my-5 rounded-xl border border-white/5 bg-ink-900/60 p-4">
                  <div className="font-mono text-2xl font-bold text-green-400">{t.highlight}</div>
                  <div className="text-[11px] font-medium text-zinc-400">{t.highlightLabel}</div>
                </div>

                <ul className="mb-6 flex-1 space-y-2.5 text-xs text-zinc-300">
                  {t.points.map((p) => (
                    <li key={p} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-400" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href={t.href}
                  className={`w-full justify-center text-xs ${
                    t.featured ? 'btn-primary' : 'btn-outline'
                  }`}
                >
                  {t.cta}
                </a>
              </motion.div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.3}>
          <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-green-500/25 bg-gradient-to-r from-green-500/10 via-ink-850 to-green-500/10 p-5 sm:flex-row sm:p-6">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-green-500/20 text-green-400">
                <Users className="h-5 w-5" />
              </div>
              <p className="text-sm text-zinc-200">
                <b className="text-white">Ready to start earning $4.00 to $12.00 every day?</b> Register your account now and get your first 2 tasks immediately.
              </p>
            </div>
            <a href={`${DASHBOARD_URL}/register`} className="btn-primary shrink-0 text-xs">
              Register & Start Daily Tasks <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
