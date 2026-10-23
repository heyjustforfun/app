import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Building, CheckCircle2, Mail, MessageSquare, Send } from 'lucide-react';
import { Reveal, SectionHeading } from '../components/ui';
import { DASHBOARD_URL, api } from '../lib/api';

const TOPICS = [
  'Daily Tasks & Verification',
  'Investment Packages',
  'Deposits & Instant Withdrawals',
  'KYC & Identity Clearance',
  'Other Inquiries',
];

export default function Contact({ settings }) {
  const [form, setForm] = useState({ name: '', email: '', topic: TOPICS[0], message: '' });
  const [state, setState] = useState({ sending: false, sent: false, error: '' });

  const submit = async (e) => {
    e.preventDefault();
    setState({ sending: true, sent: false, error: '' });
    try {
      await api('/public/inquiries', { method: 'POST', body: JSON.stringify(form) });
      setState({ sending: false, sent: true, error: '' });
      setForm({ name: '', email: '', topic: TOPICS[0], message: '' });
    } catch (err) {
      setState({ sending: false, sent: false, error: err.message });
    }
  };

  const channels = [
    { icon: MessageSquare, title: 'Investor Support Chat', text: 'Message our team directly from your dashboard after signing in.', href: `${DASHBOARD_URL}/support` },
    settings.support_email && { icon: Mail, title: 'Email', text: settings.support_email, href: `mailto:${settings.support_email}` },
    settings.office_address && { icon: Building, title: 'Compliance Desk', text: settings.office_address },
  ].filter(Boolean);

  return (
    <section id="contact" className="py-24 scroll-mt-20">
      <div className="mx-auto w-full max-w-[1720px] px-4 sm:px-8 lg:px-12 xl:px-16">
        <SectionHeading
          eyebrow="Support & Inquiries"
          title="Contact Our Compliance & Support Desk"
          subtitle="Have questions regarding daily tasks, institutional fund allocations, or identity clearance? Our team is available 24/7."
        />
        <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
          <div className="space-y-4">
            {channels.map((c, i) => (
              <Reveal key={c.title} delay={i * 0.1}>
                <a href={c.href} className={`card group flex gap-4 p-5 transition ${c.href ? 'hover:border-green-500/30' : 'pointer-events-none'}`}>
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-green-500/10 text-green-400">
                    <c.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">{c.title}</div>
                    <div className="mt-0.5 text-sm text-zinc-400">{c.text}</div>
                  </div>
                </a>
              </Reveal>
            ))}
            {settings.support_phone && <p className="px-1 text-sm text-zinc-500">Phone: {settings.support_phone}</p>}
          </div>

          <Reveal delay={0.15}>
            <form onSubmit={submit} className="card space-y-4 p-6 sm:p-8">
              <h3 className="text-lg font-semibold text-white">Send us a message</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <input className="input" placeholder="Your name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <input className="input" type="email" placeholder="Email address" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <select className="input" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}>
                {TOPICS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <textarea
                className="input min-h-32"
                placeholder="How can our compliance & support team assist you?"
                required
                minLength={10}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              />
              <AnimatePresence>
                {state.error && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-rose-400">
                    {state.error}
                  </motion.p>
                )}
                {state.sent && (
                  <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-sm text-green-400">
                    <CheckCircle2 className="h-4 w-4" /> Thanks! We received your inquiry and will reply shortly.
                  </motion.p>
                )}
              </AnimatePresence>
              <button className="btn-primary w-full" disabled={state.sending}>
                <Send className="h-4 w-4" /> {state.sending ? 'Sending…' : 'Send Message'}
              </button>
            </form>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
