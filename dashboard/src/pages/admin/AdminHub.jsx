import { NavLink, Outlet, useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowDownLeft, ArrowUpRight, BadgeCheck, CheckCircle2, CheckSquare, Landmark, ShieldCheck, Users } from 'lucide-react';
import { usd } from '../../lib/api';
import { StatCard } from '../../components/ui';

const TABS = [
  ['/admin', 'Command Hub', null, true],
  ['/admin/tasks', 'Daily Task Management', 'tasks'],
  ['/admin/users', 'User Management', 'users'],
  ['/admin/deposits', 'Deposit Approvals', 'deposits'],
  ['/admin/withdrawals', 'Withdrawal Clearances', 'withdrawals'],
  ['/admin/kyc', 'KYC Reviews', 'kyc'],
  ['/admin/support', 'Support Desk', 'support'],
];

export default function AdminHub() {
  const ctx = useOutletContext();
  const s = ctx.stats;
  const counts = s && {
    tasks: s.tasks_pending,
    deposits: s.deposits.pending,
    withdrawals: s.withdrawals.pending,
    users: s.users.total,
    kyc: s.users.kyc_pending,
    support: s.support_unread,
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="flex items-center gap-2.5 text-2xl font-bold text-white">
          <ShieldCheck className="h-6 w-6 text-green-400" /> Staff Administration Command Hub
        </h2>
        <p className="mt-1 text-sm text-zinc-500">Review bank deposits, settle verified withdrawals, publish fund NAVs and manage investor accounts.</p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} label="Pending deposits" value={s ? s.deposits.pending : '—'} valueClass="text-amber-400" icon={ArrowUpRight} tone="amber" hint={s && `Vol: ${usd(s.deposits.pending_volume)}`} />
        <StatCard index={1} label="Pending payouts" value={s ? s.withdrawals.pending : '—'} valueClass="text-sky-400" icon={ArrowDownLeft} tone="blue" hint={s && `Vol: ${usd(s.withdrawals.pending_volume)}`} />
        <StatCard index={2} label="Assets under management" value={s ? usd(s.aum) : '—'} valueClass="text-green-400" icon={Landmark} tone="green" hint={s && `Approved deposits all-time: ${usd(s.deposits.approved_volume)}`} />
        <StatCard index={3} label="Registered investors" value={s ? s.users.total : '—'} icon={Users} tone="green" hint={s && `Active: ${s.users.active} · KYC pending: ${s.users.kyc_pending}`} />
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-white/5 pb-3">
        {TABS.map(([to, label, key, end]) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                isActive ? 'border-green-500 bg-green-500 text-ink-950' : 'border-white/5 bg-ink-800 text-zinc-300 hover:border-white/15 hover:text-white'
              }`
            }
          >
            {key === 'tasks' ? <CheckSquare className="h-3.5 w-3.5" /> : key === 'support' ? <CheckCircle2 className="h-3.5 w-3.5" /> : key === 'kyc' ? <BadgeCheck className="h-3.5 w-3.5" /> : null}
            {label}
            {counts && key && counts[key] > 0 ? ` (${counts[key]})` : ''}
          </NavLink>
        ))}
      </div>

      <Outlet context={ctx} />
    </div>
  );
}
