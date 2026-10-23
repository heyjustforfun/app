import { motion } from 'framer-motion';
import { ArrowDownToLine, CheckCircle2, Coins, TrendingUp, UserCheck } from 'lucide-react';
import { Reveal, SectionHeading } from '../components/ui';

const STEPS = [
  {
    icon: UserCheck,
    title: 'Create Account & KYC',
    text: 'Register in 60 seconds with simple ID verification to prevent multi-accounting abuse.',
  },
  {
    icon: CheckCircle2,
    title: 'Perform 2 Daily Tasks',
    text: 'Complete 2 daily liquidity validation tasks directly from your customer dashboard.',
  },
  {
    icon: TrendingUp,
    title: 'Earn Rewards & Invest',
    text: 'Receive daily USD task earnings instantly and optionally compound into managed funds.',
  },
  {
    icon: ArrowDownToLine,
    title: 'Instant Wire Withdrawal',
    text: 'Request withdrawals anytime directly to your verified bank wire or crypto wallet.',
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-24 scroll-mt-20">
      <div id="how" className="pointer-events-none absolute -top-20" />
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-px bg-gradient-to-r from-transparent via-green-500/20 to-transparent" />
      <div className="mx-auto w-full max-w-[1720px] px-4 sm:px-8 lg:px-12 xl:px-16">
        <SectionHeading
          eyebrow="Step-by-Step Process"
          title="How ApexLedger Operates"
          subtitle="A simple 4-step framework designed to deliver instant yield validation, task clearance, and seamless wallet payouts."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.12}>
              <motion.div whileHover={{ y: -6 }} className="card group relative h-full overflow-hidden p-6">
                <span className="absolute -top-2 right-3 font-mono text-7xl font-bold text-white/[0.04] transition group-hover:text-green-500/10">
                  0{i + 1}
                </span>
                <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl bg-green-500/10 text-green-400">
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-white">
                  <span className="mr-1.5 text-green-400">0{i + 1}</span>
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.text}</p>
                <motion.div
                  className="absolute bottom-0 left-0 h-0.5 bg-green-500"
                  initial={{ width: 0 }}
                  whileInView={{ width: '100%' }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 + i * 0.25, duration: 0.8 }}
                />
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
