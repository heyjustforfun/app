import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  Ban,
  CheckSquare,
  KeyRound,
  LogIn,
  LogOut,
  MessageSquare,
  PieChart,
  ShieldAlert,
  SlidersHorizontal,
  TrendingUp,
  UserCog,
  UserPlus,
} from 'lucide-react';
import { api, dateTime, timeAgo, usd } from '../../lib/api';
import { Badge, Empty, Spinner, Tabs } from '../../components/ui';

const FILTERS = [
  ['all', 'All'],
  ['access', 'Sign-ins'],
  ['money', 'Money'],
  ['account', 'Account'],
  ['support', 'Support'],
  ['staff', 'Staff actions'],
];

const money = (n) => usd(Math.abs(Number(n || 0)));

/** "Mozilla/5.0 (Windows NT 10.0…) … Chrome/…" → "Chrome on Windows" */
function device(ua) {
  if (!ua) return null;
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : null;
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : null;
  if (!browser && !os) return ua.slice(0, 60);
  return [browser || 'Browser', os && `on ${os}`].filter(Boolean).join(' ');
}

/** Turns one event into { icon, tone, category, text } from the investor's point of view. */
function describe(e) {
  const d = e.details || {};
  const id = e.entity_id ? `#${e.entity_id}` : '';
  switch (e.action) {
    case 'user.register':
      return { icon: UserPlus, tone: 'green', cat: 'account', text: 'Registered an account' };
    case 'user.login':
      return { icon: LogIn, tone: 'blue', cat: 'access', text: 'Signed in', sub: device(d.user_agent) };
    case 'user.login_failed':
      return { icon: ShieldAlert, tone: 'rose', cat: 'access', text: 'Failed sign-in attempt (wrong password)', sub: device(d.user_agent) };
    case 'user.login_blocked':
      return { icon: Ban, tone: 'rose', cat: 'access', text: 'Sign-in blocked: account suspended' };
    case 'user.logout':
      return { icon: LogOut, tone: 'zinc', cat: 'access', text: 'Signed out' };
    case 'user.profile_update':
      return { icon: UserCog, tone: 'zinc', cat: 'account', text: 'Updated their profile' };
    case 'user.password_change':
      return { icon: KeyRound, tone: 'amber', cat: 'account', text: 'Changed their password' };
    case 'kyc.submit':
      return { icon: BadgeCheck, tone: 'amber', cat: 'account', text: 'Submitted identity documents for review' };
    case 'kyc.verified':
      return { icon: BadgeCheck, tone: 'green', cat: 'account', text: 'Identity verified' };
    case 'kyc.rejected':
      return { icon: BadgeCheck, tone: 'rose', cat: 'account', text: `Identity documents rejected${d.note ? `: ${d.note}` : ''}` };
    case 'task.submit':
      return { icon: CheckSquare, tone: 'amber', cat: 'account', text: `Submitted proof for daily task: ${d.title || id}` };
    case 'task.approve':
      return { icon: CheckSquare, tone: 'green', cat: 'money', text: `Daily task approved and rewarded ${money(d.reward)}`, sub: d.title };
    case 'task.reject':
      return { icon: CheckSquare, tone: 'rose', cat: 'account', text: `Daily task submission rejected${d.note ? `: ${d.note}` : ''}` };
    case 'deposit.submit':
      return { icon: ArrowUpRight, tone: 'amber', cat: 'money', text: `Submitted deposit ${id} of ${money(d.amount)}` };
    case 'deposit.approve':
      return { icon: ArrowUpRight, tone: 'green', cat: 'money', text: `Deposit ${id} of ${money(d.amount)} approved and credited` };
    case 'deposit.reject':
      return { icon: ArrowUpRight, tone: 'rose', cat: 'money', text: `Deposit ${id} of ${money(d.amount)} rejected${d.note ? `: ${d.note}` : ''}` };
    case 'withdrawal.request':
      return { icon: ArrowDownLeft, tone: 'amber', cat: 'money', text: `Requested withdrawal ${id} of ${money(d.amount)}` };
    case 'withdrawal.paid':
      return { icon: ArrowDownLeft, tone: 'green', cat: 'money', text: `Withdrawal ${id} of ${money(d.amount)} paid${d.payout_reference ? ` (bank ref ${d.payout_reference})` : ''}` };
    case 'withdrawal.reject':
      return { icon: ArrowDownLeft, tone: 'rose', cat: 'money', text: `Withdrawal ${id} rejected and funds returned${d.note ? `: ${d.note}` : ''}` };
    case 'fund.invest':
      return { icon: PieChart, tone: 'green', cat: 'money', text: `Invested ${money(d.amount)} in ${e.fund_name || 'a fund'}`, sub: d.units ? `${Number(d.units).toFixed(4)} units at NAV ${Number(d.nav).toFixed(4)}` : null };
    case 'fund.redeem':
      return { icon: TrendingUp, tone: 'green', cat: 'money', text: `Redeemed ${money(d.proceeds)} from ${e.fund_name || 'a fund'}`, sub: d.units ? `${Number(d.units).toFixed(4)} units at NAV ${Number(d.nav).toFixed(4)}` : null };
    case 'admin.balance_adjust':
      return { icon: SlidersHorizontal, tone: 'amber', cat: 'money', text: `Balance ${Number(d.amount) >= 0 ? 'credited' : 'debited'} ${money(d.amount)}: ${d.reason || 'no reason given'}` };
    case 'admin.user_create':
      return { icon: UserPlus, tone: 'blue', cat: 'account', text: `Account created by staff (role: ${d.role || 'customer'})` };
    case 'admin.user_update': {
      const fields = Object.keys(d).filter((k) => k !== 'raw');
      return { icon: UserCog, tone: 'blue', cat: 'account', text: fields.length ? `Profile edited: ${fields.join(', ')}` : 'Profile saved (no changes)' };
    }
    case 'admin.user_suspend':
      return { icon: Ban, tone: 'rose', cat: 'account', text: 'Account suspended' };
    case 'admin.user_activate':
      return { icon: BadgeCheck, tone: 'green', cat: 'account', text: 'Account reactivated' };
    case 'admin.user_password_reset':
      return { icon: KeyRound, tone: 'amber', cat: 'account', text: 'Password reset by staff' };
    case 'support.message':
      return { icon: MessageSquare, tone: 'blue', cat: 'support', text: 'Sent a support message', sub: d.body };
    case 'support.staff_reply':
      return { icon: MessageSquare, tone: 'green', cat: 'support', text: 'Support replied', sub: d.body };
    default:
      return { icon: AlertTriangle, tone: 'zinc', cat: 'account', text: `${e.action} ${e.entity || ''} ${id}` };
  }
}

const TONE = {
  green: 'bg-green-500/15 text-green-400 ring-green-500/30',
  blue: 'bg-sky-500/15 text-sky-400 ring-sky-500/30',
  amber: 'bg-amber-500/15 text-amber-400 ring-amber-500/30',
  rose: 'bg-rose-500/15 text-rose-400 ring-rose-500/30',
  zinc: 'bg-white/5 text-zinc-400 ring-white/10',
};

export default function UserActivity({ userId }) {
  const [events, setEvents] = useState([]);
  const [meta, setMeta] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  const load = useCallback(
    async (before) => {
      const d = await api(`/admin/users/${userId}/activity?limit=60${before ? `&before=${encodeURIComponent(before)}` : ''}`);
      setHasMore(d.has_more);
      if (!before) {
        setMeta({ summary: d.summary, shared: d.shared_ip_accounts });
        setEvents(d.events);
      } else {
        // Pages overlap on the boundary second; keep each event once
        setEvents((cur) => {
          const seen = new Set(cur.map((e) => e.key));
          const fresh = d.events.filter((e) => !seen.has(e.key));
          if (!fresh.length) setHasMore(false);
          return [...cur, ...fresh];
        });
      }
    },
    [userId],
  );

  useEffect(() => {
    setLoading(true);
    setError(null);
    setFilter('all');
    load()
      .catch(setError)
      .finally(() => setLoading(false));
  }, [load]);

  const more = async () => {
    setLoadingMore(true);
    try {
      await load(events[events.length - 1].created_at);
    } catch (err) {
      setError(err);
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }
  if (error) return <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-300">{error.message}</div>;

  const s = meta.summary;
  const rows = events
    .map((e) => ({ e, info: describe(e) }))
    .filter(({ e, info }) => filter === 'all' || (filter === 'staff' ? e.by_staff : info.cat === filter));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ['Last seen', s.last_seen_at ? timeAgo(s.last_seen_at) : 'Never', s.last_seen_at ? dateTime(s.last_seen_at) : ''],
          ['Last sign-in IP', s.last_ip || '—', s.distinct_ips ? `${s.distinct_ips} different IP${s.distinct_ips === 1 ? '' : 's'} all-time` : ''],
          ['Sign-ins (30 days)', s.logins_30d, ''],
          ['Failed sign-ins (30 days)', s.failed_30d, s.failed_30d >= 5 ? 'Possible password guessing' : ''],
        ].map(([k, v, hint]) => (
          <div key={k} className={`rounded-xl border bg-ink-900 p-3 ${k.startsWith('Failed') && s.failed_30d >= 5 ? 'border-rose-500/40' : 'border-white/5'}`}>
            <div className="text-[10px] text-zinc-500 uppercase">{k}</div>
            <div className="mt-0.5 truncate font-mono font-semibold text-white">{v}</div>
            {hint && <div className="mt-0.5 truncate text-[11px] text-zinc-500">{hint}</div>}
          </div>
        ))}
      </div>

      {meta.shared.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <div className="flex items-center gap-2 font-semibold text-amber-300">
            <AlertTriangle className="h-4 w-4" /> Other investor accounts have signed in from the same IP address
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            This can be innocent (family, shared office or mobile network) but is worth checking against the one-person-one-account rule.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {meta.shared.map((u) => (
              <Badge key={u.id} tone={u.status === 'active' ? 'amber' : 'rose'}>
                @{u.username} · #{u.id} · last {timeAgo(u.last_seen)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Tabs tabs={FILTERS} value={filter} onChange={setFilter} />

      {rows.length === 0 ? (
        <Empty title="No activity in this view" text={hasMore ? 'Load older activity to look further back.' : undefined} />
      ) : (
        <ol className="relative space-y-1 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-white/10">
          {rows.map(({ e, info }, i) => (
            <motion.li
              key={e.key}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i, 15) * 0.02 }}
              className="relative flex gap-3 rounded-xl py-2 pr-2"
            >
              <span className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ring-1 ${TONE[info.tone]}`}>
                <info.icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm text-zinc-100">{info.text}</span>
                  {e.by_staff && (
                    <Badge tone="blue">
                      by staff{e.actor ? ` @${e.actor}` : ''}
                    </Badge>
                  )}
                </div>
                {info.sub && <p className="mt-0.5 truncate text-xs text-zinc-500">{info.sub}</p>}
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-zinc-600">
                  <span title={dateTime(e.created_at)}>
                    {dateTime(e.created_at)} · {timeAgo(e.created_at)}
                  </span>
                  {e.ip && <span className="font-mono">IP {e.ip}</span>}
                </div>
              </div>
            </motion.li>
          ))}
        </ol>
      )}

      {hasMore && (
        <button className="btn btn-ghost w-full" onClick={more} disabled={loadingMore}>
          {loadingMore && <Spinner />} Load older activity
        </button>
      )}
    </div>
  );
}
