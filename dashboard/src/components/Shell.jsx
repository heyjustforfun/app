import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  CheckSquare,
  CircleDollarSign,
  ExternalLink,
  FileText,
  FolderOpen,
  Gift,
  Home,
  Inbox,
  LayoutDashboard,
  Layers,
  LineChart,
  LogOut,
  Menu,
  MessageSquare,
  ScrollText,
  Settings,
  UserCircle,
  Users,
  Volume2,
  VolumeX,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AppContext';
import { WEBSITE_URL, api, timeAgo, usd } from '../lib/api';
import { playNotificationSound, playReceiveSound, isSoundEnabled, toggleSound } from '../lib/sound';
import { Logo } from './ui';
import InstallButton from './InstallButton';

const CUSTOMER_NAV = [
  ['Navigation', [
    ['/', 'Dashboard', LayoutDashboard],
    ['/tasks', 'Daily Task', CheckSquare],
    ['/packages', 'Packages', Layers],
  ]],
  ['Wallet & Finance', [
    ['/deposit', 'Deposit', ArrowUpRight],
    ['/withdraw', 'Withdraw Payout', ArrowDownLeft],
  ]],
  ['Account & Help', [
    ['/referrals', 'Referral & Bonus', Gift],
    ['/support', 'Support / Chat', MessageSquare, 'Live'],
    ['/profile', 'Profile & Security', UserCircle],
  ]],
];

const ADMIN_NAV = [
  ['Administration', [
    ['/admin', 'Command Hub', LayoutDashboard],
    ['/admin/tasks', 'Daily Task Management', CheckSquare, 'tasks'],
    ['/admin/users', 'User Management', Users, 'users'],
    ['/admin/deposits', 'Deposit Approvals', Layers, 'deposits'],
    ['/admin/withdrawals', 'Withdrawal Clearances', ArrowDownLeft, 'withdrawals'],
    ['/admin/kyc', 'KYC Reviews', BadgeCheck, 'kyc'],
  ]],
  ['Communication', [
    ['/admin/support', 'Support Desk', MessageSquare, 'support'],
  ]],
  ['System', [
    ['/admin/audit', 'Audit Log', ScrollText],
    ['/admin/settings', 'Platform Settings', Settings],
    ['/admin/profile', 'Admin Profile', UserCircle],
  ]],
];

const CUSTOMER_BOTTOM_NAV = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/tasks', label: 'Daily Task', icon: CheckSquare },
  { to: '/deposit', label: 'Deposit', icon: ArrowUpRight },
  { to: '/withdraw', label: 'Withdraw', icon: ArrowDownLeft },
  { to: '/profile', label: 'Profile', icon: UserCircle },
];

const ADMIN_BOTTOM_NAV = [
  { to: '/admin', label: 'Home', icon: Home },
  { to: '/admin/tasks', label: 'Daily Task', icon: CheckSquare, badge: 'tasks' },
  { to: '/admin/deposits', label: 'Deposit', icon: ArrowUpRight, badge: 'deposits' },
  { to: '/admin/withdrawals', label: 'Withdraw', icon: ArrowDownLeft, badge: 'withdrawals' },
  { to: '/admin/profile', label: 'Profile', icon: UserCircle },
];

export default function Shell({ role }) {
  const { user, logout, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notes, setNotes] = useState({ notifications: [], unread: 0, unread_chat: 0 });
  const [stats, setStats] = useState(null);
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());
  const prevNotesRef = useRef({ unread: null, unread_chat: null, initialized: false });
  const isStaff = role === 'admin' || user?.role === 'admin' || user?.role === 'agent' || role === 'agent';
  const nav = isStaff ? ADMIN_NAV : CUSTOMER_NAV;

  // Sync sound toggle across tabs and components
  useEffect(() => {
    const handlePref = (e) => setSoundOn(e.detail?.enabled ?? isSoundEnabled());
    window.addEventListener('sound-preference-changed', handlePref);
    return () => window.removeEventListener('sound-preference-changed', handlePref);
  }, []);

  const loadNotes = useCallback(() => {
    return api('/notifications')
      .then((data) => {
        setNotes(data);
        if (prevNotesRef.current.initialized) {
          const prevUnread = prevNotesRef.current.unread ?? 0;
          const prevChat = prevNotesRef.current.unread_chat ?? 0;

          // Sound alert when new system notifications arrive
          if (typeof data.unread === 'number' && data.unread > prevUnread) {
            playNotificationSound();
          }

          // Sound alert when new chat message arrives while user is not actively on the support screen
          if (typeof data.unread_chat === 'number' && data.unread_chat > prevChat) {
            if (!location.pathname.includes('/support')) {
              playReceiveSound();
            }
          }
        }
        prevNotesRef.current = {
          unread: data.unread ?? 0,
          unread_chat: data.unread_chat ?? 0,
          initialized: true,
        };
      })
      .catch(() => {});
  }, [location.pathname]);

  const loadStats = useCallback(() => (isStaff ? api('/admin/stats').then(setStats).catch(() => {}) : Promise.resolve()), [isStaff]);

  useEffect(() => {
    loadNotes();
    loadStats();
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadNotes();
        loadStats();
        // keeps the cash balance in the top bar current after staff approve deposits etc.
        if (role === 'customer') refresh();
      }
    }, 10000);
    return () => clearInterval(t);
  }, [loadNotes, loadStats, refresh, role]);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const counters = stats && {
    tasks: stats.tasks_pending,
    deposits: stats.deposits.pending,
    withdrawals: stats.withdrawals.pending,
    kyc: stats.users.kyc_pending,
    support: stats.support_unread,
    inquiries: stats.inquiries_new,
  };

  const flat = nav.flatMap(([, items]) => items);
  const current = [...flat].sort((a, b) => b[0].length - a[0].length).find(([to]) => (to === '/' || to === '/admin' ? location.pathname === to : location.pathname.startsWith(to)));

  const signOut = async () => {
    await logout();
    navigate('/login');
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b border-white/5 px-5">
        <Link to={isStaff ? '/admin' : '/'}>
          <Logo />
        </Link>
        <button className="rounded-lg p-1 text-zinc-400 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu">
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {nav.map(([section, items]) => (
          <div key={section}>
            <div className="mb-2 px-3 text-[10px] font-semibold tracking-[0.15em] text-zinc-600 uppercase">{section}</div>
            <div className="space-y-1">
              {items.map(([to, label, Icon, badge]) => {
                const count = counters && badge && counters[badge];
                return (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/' || to === '/admin'}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${
                        isActive ? 'border-green-500/30 bg-green-500/10 font-semibold text-green-400' : 'border-white/[0.04] bg-white/[0.015] text-zinc-400 hover:border-white/10 hover:text-white'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <motion.span layoutId="side-active" className="absolute top-2 bottom-2 -left-px w-[3px] rounded-full bg-green-400" />}
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1">{label}</span>
                        {count > 0 ? (
                          <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-ink-950">{count}</span>
                        ) : (
                          badge &&
                          !counters && <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-zinc-500">{badge}</span>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="space-y-3 border-t border-white/5 p-3">
        <InstallButton className="w-full" />
        <div className="flex items-center gap-3 rounded-xl px-2 py-1">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-green-500/15 text-xs font-bold text-green-400 uppercase">
            {user?.username ? user.username.slice(0, 2) : 'US'}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">{user?.full_name || user?.username || 'Account'}</div>
            <div className="truncate text-[11px] text-zinc-500">
              {user?.role === 'admin' ? 'Administrator (Smith)' : user?.role === 'agent' ? 'Agent (Alex)' : (user?.email || '')}
            </div>
          </div>
          <button onClick={signOut} className="rounded-lg p-2 text-zinc-500 transition hover:bg-white/5 hover:text-rose-400" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-white/5 bg-ink-950 lg:block">{sidebar}</aside>
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/60 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-72 border-r border-white/5 bg-ink-950 lg:hidden"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              {sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-white/5 bg-ink-900/85 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button className="rounded-lg p-2 text-zinc-300 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="truncate text-lg font-bold text-white">{current?.[1] || 'Portal'}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link to={isStaff ? '/admin/support' : '/support'} className="btn btn-ghost btn-sm relative hidden !px-3 !py-2 sm:inline-flex">
              <MessageSquare className="h-4 w-4" /> {isStaff ? 'Support Inbox' : 'Chat'}
              {notes.unread_chat > 0 && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-green-400" />}
            </Link>
            <a href={WEBSITE_URL} className="btn btn-ghost btn-sm hidden !px-3 !py-2 md:inline-flex" title="Public website">
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              onClick={() => setSoundOn(toggleSound())}
              className="relative grid h-9 w-9 place-items-center rounded-full border border-white/10 text-zinc-400 transition hover:bg-white/5 hover:text-white"
              title={soundOn ? 'Sound alerts enabled (Click to mute)' : 'Sound alerts muted (Click to enable)'}
              aria-label="Toggle sound alerts"
            >
              {soundOn ? <Volume2 className="h-4 w-4 text-green-400" /> : <VolumeX className="h-4 w-4 text-zinc-500" />}
            </button>
            <NotificationBell notes={notes} reload={loadNotes} soundOn={soundOn} setSoundOn={setSoundOn} />
            {role === 'customer' && (
              <>
                <div className="hidden items-center gap-2 rounded-xl border border-white/10 px-3 py-1.5 sm:flex">
                  <Wallet className="h-4 w-4 text-green-400" />
                  <div className="leading-tight">
                    <div className="text-[10px] text-zinc-500">Available cash</div>
                    <div className="font-mono text-sm font-bold text-green-400">{usd(user?.cash_balance ?? 0)}</div>
                  </div>
                </div>
                <Link to="/deposit" className="btn btn-primary btn-sm !px-3 !py-2">
                  <CircleDollarSign className="h-4 w-4" /> <span className="hidden sm:inline">Deposit</span>
                </Link>
              </>
            )}
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 pb-28 lg:pb-8">
          <Outlet context={{ stats, reloadStats: loadStats, reloadNotes: loadNotes }} />
        </main>
      </div>

      <MobileBottomNav isStaff={isStaff} counters={counters} />
    </div>
  );
}

function NotificationBell({ notes, reload, soundOn, setSoundOn }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const markAll = async () => {
    await api('/notifications/read-all', { method: 'POST' });
    reload();
  };
  const openNote = async (n) => {
    if (!n.read_at) await api(`/notifications/${n.id}/read`, { method: 'POST' }).catch(() => {});
    setOpen(false);
    reload();
    if (n.link) navigate(n.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="relative grid h-9 w-9 place-items-center rounded-full border border-green-500/30 text-green-400 transition hover:bg-green-500/10" aria-label="Notifications">
        <motion.span animate={notes.unread ? { rotate: [0, -15, 15, -10, 10, 0] } : {}} transition={{ duration: 0.6, repeat: notes.unread ? Infinity : 0, repeatDelay: 4 }}>
          <Bell className="h-4 w-4" />
        </motion.span>
        {notes.unread > 0 && (
          <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-green-500 px-1 text-[10px] font-bold text-ink-950">{notes.unread > 9 ? '9+' : notes.unread}</span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            className="card absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden !bg-ink-850 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">Notifications</span>
                {setSoundOn && (
                  <button
                    type="button"
                    onClick={() => setSoundOn(toggleSound())}
                    className="rounded p-1 text-zinc-400 hover:text-white hover:bg-white/5 transition"
                    title={soundOn ? 'Sound alerts enabled (Click to mute)' : 'Sound alerts muted (Click to enable)'}
                  >
                    {soundOn ? <Volume2 className="h-3.5 w-3.5 text-green-400" /> : <VolumeX className="h-3.5 w-3.5 text-zinc-500" />}
                  </button>
                )}
              </div>
              {notes.unread > 0 && (
                <button onClick={markAll} className="text-xs text-green-400 hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notes.notifications.length === 0 && <div className="p-6 text-center text-sm text-zinc-500">You're all caught up.</div>}
              {notes.notifications.map((n) => (
                <button key={n.id} onClick={() => openNote(n)} className={`block w-full border-b border-white/[0.04] px-4 py-3 text-left transition hover:bg-white/[0.03] ${n.read_at ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-2">
                    {!n.read_at && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" />}
                    <span className="text-sm font-semibold text-white">{n.title}</span>
                    <span className="ml-auto shrink-0 text-[10px] text-zinc-600">{timeAgo(n.created_at)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-400">{n.body}</p>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MobileBottomNav({ isStaff, counters }) {
  const location = useLocation();
  const items = isStaff ? ADMIN_BOTTOM_NAV : CUSTOMER_BOTTOM_NAV;

  return (
    <nav
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink-950/95 backdrop-blur-2xl pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-10px_35px_rgba(0,0,0,0.7)] lg:hidden"
      aria-label="Mobile Navigation Dock"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 items-center px-2">
        {items.map((item) => {
          const isActive =
            item.to === '/' || item.to === '/admin'
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
          const Icon = item.icon;
          const badgeCount = item.badge && counters ? counters[item.badge] : null;

          return (
            <Link
              key={item.to}
              to={item.to}
              className={`group relative flex flex-col items-center justify-center py-1 transition-all ${
                isActive
                  ? 'text-green-400 font-semibold'
                  : 'text-zinc-500 hover:text-zinc-300 font-medium'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="mobile-nav-pill"
                  className="absolute -top-2.5 h-1 w-8 rounded-full bg-gradient-to-r from-green-400 to-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.85)]"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}

              <div className="relative">
                <span
                  className={`grid h-8 w-8 place-items-center rounded-xl transition-all ${
                    isActive
                      ? 'bg-green-500/15 text-green-400 scale-105 shadow-sm'
                      : 'text-zinc-400 group-hover:bg-white/5 group-hover:text-zinc-200'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {badgeCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-black text-ink-950 shadow-md">
                    {badgeCount}
                  </span>
                )}
              </div>

              <span className={`mt-0.5 truncate text-[10px] tracking-tight transition-colors ${
                isActive ? 'font-semibold text-green-400' : 'font-medium text-zinc-500 group-hover:text-zinc-300'
              }`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
