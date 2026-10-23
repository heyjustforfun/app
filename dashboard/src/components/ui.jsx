import { useEffect, useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Inbox, Loader2, X, Zap } from 'lucide-react';
import { BRAND } from '../lib/api';

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-green-500 text-ink-950 shadow-[0_0_24px_-4px_rgba(34,197,94,0.7)]">
        <Zap className="h-5 w-5" fill="currentColor" strokeWidth={1.5} />
      </span>
      <span className="text-lg font-bold tracking-tight text-white">{BRAND.name}</span>
      <span className="rounded-md border border-green-500/30 bg-green-500/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-green-400">
        {BRAND.tag}
      </span>
    </span>
  );
}

export function Card({ title, subtitle, icon: Icon, actions, children, className = '', bodyClass = 'p-5 sm:p-6' }) {
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className={`card ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
          <div>
            {title && (
              <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                {Icon && <Icon className="h-4 w-4 text-green-400" />}
                {title}
              </h2>
            )}
            {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </motion.section>
  );
}

const TONES = {
  green: 'text-green-400 bg-green-500/10',
  amber: 'text-amber-400 bg-amber-500/10',
  blue: 'text-sky-400 bg-sky-500/10',
  rose: 'text-rose-400 bg-rose-500/10',
  zinc: 'text-zinc-300 bg-white/5',
};

export function StatCard({ label, value, hint, icon: Icon, tone = 'zinc', valueClass = 'text-white', index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4 }}
      whileHover={{ y: -3 }}
      className="card p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">{label}</span>
        {Icon && (
          <span className={`grid h-8 w-8 place-items-center rounded-lg ${TONES[tone]}`}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className={`mt-3 font-mono text-2xl font-bold tracking-tight ${valueClass}`}>{value}</div>
      {hint && <div className="mt-2 text-xs text-zinc-500">{hint}</div>}
    </motion.div>
  );
}

const BADGE = {
  green: 'border-green-500/25 bg-green-500/10 text-green-400',
  amber: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
  rose: 'border-rose-500/25 bg-rose-500/10 text-rose-300',
  blue: 'border-sky-500/25 bg-sky-500/10 text-sky-300',
  zinc: 'border-white/10 bg-white/5 text-zinc-400',
};

export function Badge({ tone = 'zinc', children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${BADGE[tone]} ${className}`}>
      {children}
    </span>
  );
}

const STATUS_TONE = {
  pending: 'amber',
  approved: 'green',
  paid: 'green',
  verified: 'green',
  active: 'green',
  open: 'green',
  rejected: 'rose',
  suspended: 'rose',
  closed: 'zinc',
  none: 'zinc',
  new: 'blue',
};

export function StatusBadge({ status }) {
  const label = status === 'none' ? 'Not submitted' : status;
  return (
    <Badge tone={STATUS_TONE[status] || 'zinc'} className="uppercase">
      {label}
    </Badge>
  );
}

export function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className={`card max-h-[92vh] w-full overflow-y-auto rounded-b-none !bg-ink-850 sm:rounded-2xl ${wide ? 'max-w-4xl' : 'max-w-lg'}`}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-ink-850 px-5 py-4">
              <h3 className="font-semibold text-white">{title}</h3>
              <button onClick={onClose} className="rounded-lg p-1 text-zinc-500 hover:bg-white/5 hover:text-white" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="label">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-[11px] text-zinc-600">{hint}</span>}
    </label>
  );
}

export function Empty({ icon: Icon = Inbox, title = 'Nothing here yet', text, children }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 px-6 py-12 text-center">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-3 text-green-400">
        <Icon className="h-9 w-9" strokeWidth={1.5} />
      </motion.div>
      <div className="font-semibold text-white">{title}</div>
      {text && <p className="mt-1 max-w-md text-sm text-zinc-500">{text}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

export function Spinner({ className = '' }) {
  return <Loader2 className={`h-5 w-5 animate-spin text-green-400 ${className}`} />;
}

export function Loading() {
  return (
    <div className="flex justify-center py-16">
      <Spinner className="h-7 w-7" />
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  return (
    <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-300">
      {error?.message || 'Something went wrong.'}
      {onRetry && (
        <button onClick={onRetry} className="ml-3 underline">
          Try again
        </button>
      )}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  const layoutId = useId();
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-white/5 bg-ink-900 p-1">
      {tabs.map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`relative rounded-lg px-3 py-1.5 text-xs font-semibold transition ${value === key ? 'text-ink-950' : 'text-zinc-400 hover:text-white'}`}
        >
          {value === key && <motion.span layoutId={layoutId} className="absolute inset-0 rounded-lg bg-green-500" />}
          <span className="relative">{label}</span>
        </button>
      ))}
    </div>
  );
}

export function Pager({ page, size, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
      <span>
        Page {page} of {pages} · {total} records
      </span>
      <div className="flex gap-2">
        <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}
