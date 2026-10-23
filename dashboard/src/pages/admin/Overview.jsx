import { Link, useOutletContext } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowRight, CheckSquare, PieChart, Users } from 'lucide-react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApi } from '../../context/AppContext';
import { dateTime, usd } from '../../lib/api';
import { Card, Empty, Loading, StatusBadge } from '../../components/ui';
import { actionLabel } from './Audit';

const COLORS = ['#22c55e', '#4ade80', '#86efac', '#a3e635', '#16a34a'];

export default function Overview() {
  const { stats: s } = useOutletContext();
  const recentUsers = useApi('/admin/users?size=5');
  const audit = useApi('/admin/audit?size=10');
  const recentTasks = useApi('/admin/tasks/submissions?size=5');

  const todo = s
    ? [
        [s.tasks_pending, 'daily task submissions waiting for review', '/admin/tasks'],
        [s.deposits.pending, 'deposits waiting for review', '/admin/deposits'],
        [s.withdrawals.pending, 'withdrawals to settle', '/admin/withdrawals'],
        [s.users.kyc_pending, 'identity verifications pending', '/admin/kyc'],
        [s.support_unread, 'support conversations unread', '/admin/support'],
      ].filter(([n]) => n > 0)
    : [];

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
      <Card title="Needs attention" icon={AlertTriangle}>
        {!s ? (
          <Loading />
        ) : todo.length === 0 ? (
          <Empty title="All queues are clear" text="New deposits, withdrawals and messages will show up here." />
        ) : (
          <div className="space-y-2">
            {todo.map(([n, label, to]) => (
              <Link key={to} to={to} className="group flex items-center justify-between rounded-xl border border-white/5 bg-ink-900 p-4 transition hover:border-amber-500/30">
                <span className="text-sm text-zinc-300">
                  <b className="mr-1.5 font-mono text-lg text-amber-400">{n}</b> {label}
                </span>
                <ArrowRight className="h-4 w-4 text-zinc-600 transition group-hover:translate-x-1 group-hover:text-amber-400" />
              </Link>
            ))}
          </div>
        )}
        {s && (
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-white/5 bg-ink-900 p-3">
              <div className="text-[10px] text-zinc-500 uppercase">Uninvested client cash</div>
              <div className="font-mono font-semibold text-white">{usd(s.cash_held)}</div>
            </div>
            <div className="rounded-xl border border-white/5 bg-ink-900 p-3">
              <div className="text-[10px] text-zinc-500 uppercase">Paid out all-time</div>
              <div className="font-mono font-semibold text-white">{usd(s.withdrawals.paid_volume)}</div>
            </div>
          </div>
        )}
      </Card>

      <Card
        title="Recent Investor Activity & Controls"
        subtitle="Live login status, active investment packages & quick chat"
        icon={Users}
        actions={<Link to="/admin/users" className="btn btn-ghost btn-sm">All Users →</Link>}
      >
        {recentUsers.loading && !recentUsers.data ? (
          <Loading />
        ) : (recentUsers.data?.users || []).length === 0 ? (
          <Empty title="No users registered yet" />
        ) : (
          <div className="divide-y divide-white/5">
            {recentUsers.data.users.slice(0, 5).map((u) => (
              <div key={u.id} className="flex items-center justify-between py-2.5 text-sm">
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 font-mono text-xs font-bold text-emerald-400 border border-emerald-500/20">
                      {u.username[0]?.toUpperCase()}
                    </div>
                    {u.is_online ? (
                      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-ink-950 bg-emerald-400 animate-pulse" />
                    ) : null}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 font-semibold text-white">
                      @{u.username}
                      {u.is_online ? (
                        <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-medium text-emerald-300">
                          Active now
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-zinc-400">
                      {u.active_package_name ? (
                        <span className="text-emerald-400 font-medium">{u.active_package_name} (${Number(u.active_package_amount).toFixed(0)})</span>
                      ) : (
                        <span className="text-zinc-500">No package</span>
                      )}
                      {' · '}
                      Cash: <b className="font-mono text-zinc-200">{usd(u.cash_balance)}</b>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link to={`/admin/support?user=${u.id}`} className="btn btn-primary btn-sm">
                    Chat
                  </Link>
                  <Link to={`/admin/users`} className="btn btn-ghost btn-sm">
                    Manage
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        title="Recent Daily Task Records"
        subtitle="Live verification proofs, trade codes & investor rewards"
        icon={CheckSquare}
        actions={<Link to="/admin/tasks" className="btn btn-ghost btn-sm">Task Desk →</Link>}
      >
        {recentTasks.loading && !recentTasks.data ? (
          <Loading />
        ) : (recentTasks.data?.submissions || []).length === 0 ? (
          <Empty title="No task submissions yet" text="When investors complete daily tasks, their records appear here." />
        ) : (
          <div className="divide-y divide-white/5">
            {recentTasks.data.submissions.slice(0, 5).map((sub) => (
              <div key={sub.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-emerald-400">{sub.task_code || `#${sub.task_id}`}</span>
                    <span className="font-semibold text-white">@{sub.username}</span>
                    <StatusBadge status={sub.status} />
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5 truncate max-w-xs">
                    {sub.title || 'Daily Verification Task'} · <span className="font-mono font-bold text-emerald-400">{usd(sub.reward_paid || 0)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-500">{dateTime(sub.created_at)}</span>
                  <Link to="/admin/tasks" className="btn btn-ghost btn-sm text-xs">
                    Review
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Recent staff & system activity" icon={Activity} className="xl:col-span-2" actions={<Link to="/admin/audit" className="btn btn-ghost btn-sm">Full audit log</Link>}>
        {audit.loading && !audit.data ? (
          <Loading />
        ) : (
          <div className="divide-y divide-white/5">
            {audit.data?.entries.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span>
                  <b className="text-white">{e.actor ? `@${e.actor}` : 'System'}</b> <span className="text-zinc-400">{actionLabel(e.action)}</span>{' '}
                  <span className="text-zinc-600">
                    {e.entity} {e.entity_id ? `#${e.entity_id}` : ''}
                  </span>
                </span>
                <span className="text-xs text-zinc-600">{dateTime(e.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
