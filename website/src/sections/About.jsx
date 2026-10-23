import { motion } from 'framer-motion';
import { CheckCircle2, Cpu, ShieldCheck, Users } from 'lucide-react';
import { Reveal, SectionHeading } from '../components/ui';

const CARDS = [
  {
    icon: Cpu,
    title: 'Task Protocol',
    text: 'Micro daily consensus verification tasks that reward members with direct USD settlements upon completing rapid platform actions.',
  },
  {
    icon: ShieldCheck,
    title: 'Strict Proof Policy',
    text: 'Instant 1-click proof submission with automated verification and fraud protection to preserve institutional capital health.',
  },
  {
    icon: Users,
    title: 'More Referrals = More Tasks',
    text: 'Base tier gives 2 daily tasks. Grow your network to unlock 3, 4, or VIP tier quotas with magnified compounding yield.',
  },
];

export default function About({ stats }) {
  return (
    <section id="about" className="relative py-24 scroll-mt-20">
      <div className="mx-auto w-full max-w-[1720px] px-4 sm:px-8 lg:px-12 xl:px-16">
        <SectionHeading
          eyebrow="Pioneering Task Architecture"
          title="Pioneering Transparent Decentralized Task Yields"
          subtitle="A verified system where micro daily engagements and institutional fund consensus combine to deliver predictable daily returns."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {CARDS.map((c, i) => (
            <Reveal key={c.title} delay={i * 0.1}>
              <motion.div whileHover={{ y: -6 }} className="card group h-full p-6 transition-colors hover:border-green-500/30">
                <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl border border-green-500/20 bg-green-500/10 text-green-400 transition group-hover:scale-110 group-hover:bg-green-500 group-hover:text-ink-950">
                  <c.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-white">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{c.text}</p>
              </motion.div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.2}>
          <div className="card mt-6 grid grid-cols-2 divide-white/5 md:grid-cols-4 md:divide-x">
            {[
              ['150,000+', 'Validations Processed'],
              ['100%', 'Auditable Ledger'],
              ['2.1 Hours', 'Avg Clearance Time'],
              ['25+ LPs', 'Institutional Partners'],
            ].map(([v, l], i) => (
              <div key={i} className="p-6 text-center">
                <div className="font-mono text-2xl font-bold text-white">{v}</div>
                <div className="mt-1 text-xs text-zinc-500">{l}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
