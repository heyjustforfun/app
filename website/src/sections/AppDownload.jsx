import { motion } from 'framer-motion';
import { Apple, Check, Download, Monitor, Smartphone } from 'lucide-react';
import { Reveal, SectionHeading } from '../components/ui';

const APPS = [
  {
    id: 'android',
    icon: Smartphone,
    badge: 'Android',
    title: 'Android App',
    text: 'Access daily verification tasks and track liquidity accruals with 1-tap mobile access.',
    points: ['Full-screen task execution', 'Push notifications for new tasks', 'Instant biometric access'],
    cta: 'Install on Android',
  },
  {
    id: 'ios',
    icon: Apple,
    badge: 'iOS',
    title: 'iOS App (iPhone)',
    text: 'Seamless mobile experience via Safari Progressive Web App with home-screen launch.',
    points: ['Launches like a native iOS app', 'Daily task clearance alerts', 'Instant wire withdrawals'],
    cta: 'Open on iPhone',
  },
  {
    id: 'desktop',
    icon: Monitor,
    badge: 'Windows & Mac',
    title: 'Desktop Client',
    text: 'Complete workstation setup for continuous liquidity consensus monitoring and multi-fund tracking.',
    points: ['Dedicated desktop interface', 'Fast keyboard navigation', 'Live dual-ledger auditing'],
    cta: 'Install Desktop App',
  },
];

export default function AppDownload({ onOpenInstall }) {
  return (
    <section id="app" className="py-24">
      <div className="mx-auto w-full max-w-[1720px] px-4 sm:px-8 lg:px-12 xl:px-16">
        <SectionHeading
          eyebrow="Mobile & Desktop Suite"
          title="Download the Official ApexLedger App"
          subtitle="Complete your daily tasks, track yield accruals, and initiate instant withdrawals from any device."
        />
        <div className="grid gap-5 md:grid-cols-3">
          {APPS.map((a, i) => (
            <Reveal key={a.title} delay={i * 0.1}>
              <motion.div whileHover={{ y: -6 }} className="card flex h-full flex-col p-6">
                <div className="flex items-center justify-between">
                  <motion.div
                    className="grid h-12 w-12 place-items-center rounded-2xl bg-green-500/10 text-green-400"
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 3, repeat: Infinity, delay: i * 0.4 }}
                  >
                    <a.icon className="h-6 w-6" />
                  </motion.div>
                  <span className="rounded-md border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold text-green-400">{a.badge}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">{a.title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{a.text}</p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-zinc-300">
                  {a.points.map((p) => (
                    <li key={p} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 text-green-400" /> {p}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => onOpenInstall ? onOpenInstall(a.id) : null}
                  className={`mt-6 w-full justify-center ${i === 0 ? 'btn-primary' : 'btn-outline'}`}
                >
                  <Download className="h-4 w-4" /> {a.cta}
                </button>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
