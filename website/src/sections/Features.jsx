import { motion } from 'framer-motion';
import { Cpu, Database, Landmark, Lock, RefreshCw, UserCheck } from 'lucide-react';
import { Reveal, SectionHeading } from '../components/ui';

const FEATURES = [
  {
    icon: RefreshCw,
    title: 'Automated Daily Clearing Engine',
    text: 'Tasks and NAV validations are processed on automated cycles, crediting your investor wallet within hours.',
  },
  {
    icon: UserCheck,
    title: 'KYC Verified Global Investors',
    text: '1-person 1-ID enforcement ensures institutional liquidity pools remain completely fraud-free and sybil-resistant.',
  },
  {
    icon: Database,
    title: 'Smart Contract + Database Dual Ledger',
    text: 'Every yield credit and transaction is mirrored across an immutable cryptographic ledger and audit trail.',
  },
  {
    icon: Landmark,
    title: 'Real-World Asset Treasury Backing',
    text: 'Institutional reserves and short-duration treasury securities back every single yield distribution dollar-for-dollar.',
  },
  {
    icon: Cpu,
    title: '1% Compound Yield Engine',
    text: 'Automatically roll daily task earnings into high-performing managed funds for explosive monthly compounding.',
  },
  {
    icon: Lock,
    title: 'Enterprise-Grade Security (AES-256)',
    text: 'Military-grade encryption, bank-wire custody isolation, and multi-sig authorization protect all user assets.',
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24 scroll-mt-20">
      <div className="mx-auto w-full max-w-[1720px] px-4 sm:px-8 lg:px-12 xl:px-16">
        <SectionHeading
          eyebrow="Core Architecture"
          title="Institutional-Engine Features"
          subtitle="Purpose-built infrastructure for daily liquidity validation and predictable investor returns."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 0.1}>
              <motion.div whileHover={{ y: -4 }} className="card group relative flex h-full gap-4 overflow-hidden p-6">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-green-500/0 to-green-500/0 transition duration-500 group-hover:from-green-500/[0.07]" />
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-ink-900 text-green-400 transition group-hover:border-green-500/40 group-hover:shadow-[0_0_20px_-4px_rgba(34,197,94,0.6)]">
                  <f.icon className="h-5 w-5" />
                </div>
                <div className="relative">
                  <h3 className="font-semibold text-white">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{f.text}</p>
                </div>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
