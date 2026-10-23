import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import {
  Ban,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  MessageSquare,
  Package,
  PackageCheck,
  Pencil,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  Users as UsersIcon,
  Wallet,
} from 'lucide-react';
import { useApi, useAuth, useToast } from '../../context/AppContext';
import { RISK, api, date, dateTime, timeAgo, units, usd } from '../../lib/api';
import { Badge, Card, Empty, ErrorBox, Field, Loading, Modal, Pager, Spinner, StatusBadge, Tabs } from '../../components/ui';
import TxTable from '../../components/TxTable';
import UserActivity from './UserActivity';
import Chat from '../../components/Chat';

export default function Users() {
  const { reloadStats } = useOutletContext();
  const { user: me } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const initialQ = params.get('q') || '';
  const [q, setQ] = useState(initialQ);
  const [query, setQuery] = useState(initialQ);
  const [tab, setTab] = useState('all');
  const [sort, setSort] = useState('recent_activity');
  const [page, setPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const endpoint = `/admin/users?page=${page}&size=50&q=${encodeURIComponent(query)}&tab=${tab}&sort=${sort}`;
  const { data, loading, error, reload } = useApi(endpoint);
  const [modal, setModal] = useState(null); // { type, user }

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  // Sync from URL ?q=... (e.g. from notification clicks)
  useEffect(() => {
    const fromUrl = params.get('q');
    if (fromUrl !== null && fromUrl !== q) {
      setQ(fromUrl);
      setQuery(fromUrl);
      setPage(1);
    }
  }, [params]);

  // Live auto-refresh polling every 6 seconds so user logins appear in real-time
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        reload();
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [reload]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await reload();
    await reloadStats();
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const done = () => {
    setModal(null);
    reload();
    reloadStats();
  };

  const toggleStatus = async (u) => {
    const next = u.status === 'active' ? 'suspended' : 'active';
    if (next === 'suspended' && !confirm(`Suspend @${u.username}? They will be signed out immediately.`)) return;
    try {
      await api(`/admin/users/${u.id}/status`, { method: 'POST', body: { status: next } });
      toast.success(`@${u.username} ${next === 'active' ? 'reactivated' : 'suspended'}`);
      done();
    } catch (err) {
      toast.error(err);
    }
  };

  const remove = async (u) => {
    if (!confirm(`Permanently delete @${u.username}? This only works for accounts with no financial history.`)) return;
    try {
      await api(`/admin/users/${u.id}`, { method: 'DELETE' });
      toast.success('User deleted');
      done();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <div className="space-y-4">
      <Card
        title="User Management & Real-Time Controls"
        subtitle="Live login tracking, direct customer chat, instant cash adjustments and complete account controls."
        icon={UsersIcon}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleManualRefresh}
              className="btn btn-outline btn-sm gap-1.5"
              title="Refresh users list"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                className="input !w-60 pl-9"
                placeholder="Search user, email, ID…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <button className="btn btn-primary btn-sm gap-1.5" onClick={() => setModal({ type: 'create' })}>
              <UserPlus className="h-4 w-4" /> Add User
            </button>
          </div>
        }
      >
        {/* Filter Tabs & Sort Controls */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
          <Tabs
            tabs={[
              ['all', 'All Users'],
              ['online', '🟢 Online / Active Now'],
              ['invested', '📦 Active Package'],
              ['kyc', '⏳ KYC Pending'],
              ['suspended', '🚫 Suspended'],
            ]}
            value={tab}
            onChange={(t) => {
              setTab(t);
              setPage(1);
            }}
          />

          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>Sort by:</span>
            <select
              className="input !h-8 !py-0 !text-xs font-medium"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="recent_activity">⚡ Recently Active / Logged In</option>
              <option value="cash_desc">💰 Highest Cash Balance</option>
              <option value="invested_desc">📈 Highest Invested Value</option>
              <option value="id_desc">🆕 Newest Registrations</option>
              <option value="username_asc">🔤 Username (A-Z)</option>
            </select>
          </div>
        </div>

        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorBox error={error} onRetry={reload} />
        ) : data.users.length === 0 ? (
          <Empty title="No users found" text="No accounts match your current filter or search criteria." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>User Profile</th>
                    <th>Password & Access</th>
                    <th>Live Status / Login</th>
                    <th>Active Package</th>
                    <th className="text-right">Cash Balance</th>
                    <th className="text-right">Invested Value</th>
                    <th>KYC & ID</th>
                    <th>Account</th>
                    <th className="text-right">Actions & Controls</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((u) => (
                    <tr key={u.id} className="transition hover:bg-white/[0.02]">
                      {/* ID */}
                      <td className="font-mono font-semibold text-zinc-400">#{u.id}</td>

                      {/* User Profile */}
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 font-mono text-sm font-bold text-emerald-400 border border-emerald-500/20">
                              {u.username[0]?.toUpperCase()}
                            </div>
                            {u.is_online ? (
                              <span
                                className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-ink-950 bg-emerald-400 animate-pulse"
                                title="Active online now"
                              />
                            ) : null}
                          </div>
                          <div>
                            <button
                              onClick={() => setModal({ type: 'view', user: u })}
                              className="text-left font-semibold text-white hover:text-emerald-400 transition"
                            >
                              @{u.username}
                            </button>
                            <div className="text-xs text-zinc-400">{u.full_name || 'No name provided'}</div>
                            <div className="text-[11px] text-zinc-500">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Password & Access (Admin can see password with 1-click toggle and copy) */}
                      <td>
                        <PasswordDisplay password={u.plain_password} />
                      </td>

                      {/* Live Status / Login */}
                      <td>
                        {u.is_online ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 animate-pulse">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Online now
                          </span>
                        ) : u.last_login_at ? (
                          <div>
                            <div className="flex items-center gap-1 text-xs text-zinc-300">
                              <Clock className="h-3 w-3 text-zinc-500" /> {timeAgo(u.last_login_at)}
                            </div>
                            <div className="text-[10px] text-zinc-500" title={dateTime(u.last_login_at)}>
                              {date(u.last_login_at)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-600">Never logged in</span>
                        )}
                      </td>

                      {/* Active Package with quick manage button */}
                      <td>
                        {u.active_package_name ? (
                          <div>
                            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                              <PackageCheck className="h-3.5 w-3.5" />
                              {u.active_package_name}
                            </span>
                            <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-400">
                              <b className="text-emerald-300 font-mono">${Number(u.active_package_invested || u.active_package_amount || 0).toFixed(0)}</b>
                              {' · '}
                              <span>{u.tasks_completed_today || 0}/2 Tasks</span>
                              <button
                                onClick={() => setModal({ type: 'package', user: u })}
                                className="font-medium text-emerald-400/90 hover:text-emerald-300 hover:underline"
                                title="Change or update package"
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-zinc-600">No package</span>
                            <button
                              onClick={() => setModal({ type: 'package', user: u })}
                              className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400 hover:bg-emerald-500/20 transition"
                            >
                              + Assign
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Cash Balance with direct set/adjust button */}
                      <td className="text-right">
                        <div className="font-mono text-base font-bold text-emerald-400">{usd(u.cash_balance)}</div>
                        <button
                          onClick={() => setModal({ type: 'balance', user: u })}
                          className="mt-0.5 text-[11px] font-medium text-emerald-400/80 hover:text-emerald-300 hover:underline"
                        >
                          ⚙️ Manage Balance
                        </button>
                      </td>

                      {/* Invested Value */}
                      <td className="text-right">
                        <div className="font-mono text-sm font-semibold text-zinc-200">{usd(u.portfolio_value)}</div>
                      </td>

                      {/* KYC & ID */}
                      <td>
                        {u.national_id ? (
                          <span className="font-mono text-xs text-emerald-400">{u.national_id}</span>
                        ) : (
                          <span className="text-xs text-zinc-600">Unbound</span>
                        )}
                        <div className="mt-1">
                          <StatusBadge status={u.kyc_status} />
                        </div>
                      </td>

                      {/* Account Status */}
                      <td>
                        <StatusBadge status={u.status} />
                        <div className="mt-1">
                          <Badge tone={u.role === 'admin' ? 'blue' : u.role === 'agent' ? 'purple' : 'zinc'} className="text-[10px] uppercase">
                            {u.role === 'agent' ? 'Agent (Staff)' : u.role}
                          </Badge>
                        </div>
                      </td>

                      {/* Actions & Controls */}
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Direct Chat Button */}
                          <button
                            className="btn btn-primary btn-sm gap-1"
                            onClick={() => setModal({ type: 'chat', user: u })}
                            title={`Open direct chat with @${u.username}`}
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span>Chat</span>
                          </button>

                          {/* Balance Control Button */}
                          <button
                            className="btn btn-outline btn-sm gap-1"
                            onClick={() => setModal({ type: 'balance', user: u })}
                            title="Set or adjust cash balance"
                          >
                            <CircleDollarSign className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Balance</span>
                          </button>

                          {/* Package Control Button */}
                          <button
                            className="btn btn-outline btn-sm gap-1"
                            onClick={() => setModal({ type: 'package', user: u })}
                            title="Assign, change or remove investment package"
                          >
                            <PackageCheck className="h-3.5 w-3.5 text-blue-400" />
                            <span className="hidden sm:inline">Package</span>
                          </button>

                          {/* Edit User Profile & Password */}
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setModal({ type: 'edit', user: u })}
                            title="Edit user details or change password"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>

                          {/* View Full Activity & Ledger */}
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setModal({ type: 'view', user: u })}
                            title="View full account activity, password & ledger"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          {/* Suspend / Reactivate */}
                          {u.id !== me.id && (
                            <button
                              className={`btn btn-sm ${u.status === 'active' ? 'btn-warn' : 'btn-outline'}`}
                              onClick={() => toggleStatus(u)}
                              title={u.status === 'active' ? 'Suspend user account' : 'Reactivate account'}
                            >
                              {u.status === 'active' ? <Ban className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                            </button>
                          )}

                          {/* Delete Account */}
                          {u.id !== me.id && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => remove(u)}
                              title="Delete user account (only if no financial history)"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={data.page} size={data.size} total={data.total} onPage={setPage} />
          </>
        )}

        {/* Modal Dialogs */}
        <UserFormModal modal={modal} onClose={() => setModal(null)} onDone={done} />
        <BalanceControlModal modal={modal} onClose={() => setModal(null)} onDone={done} />
        <PackageControlModal modal={modal} onClose={() => setModal(null)} onDone={done} />
        <UserDetailModal
          modal={modal}
          onClose={() => setModal(null)}
          onOpenBalance={(u) => setModal({ type: 'balance', user: u })}
          onOpenPackage={(u) => setModal({ type: 'package', user: u })}
        />
        <DirectChatModal modal={modal} onClose={() => setModal(null)} />
      </Card>
    </div>
  );
}

/**
 * Reusable Password Display Widget with Show/Hide toggle and 1-Click Copy
 * Allows admin to instantly see or copy any user's login password.
 */
function PasswordDisplay({ password, defaultHidden = true }) {
  const [show, setShow] = useState(!defaultHidden);
  const [copied, setCopied] = useState(false);

  const copy = (e) => {
    e.stopPropagation();
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!password) {
    return <span className="font-mono text-[11px] text-zinc-500 italic">Encrypted</span>;
  }

  return (
    <div className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-ink-950/90 px-2 py-1 shadow-sm">
      <span className="font-mono text-xs font-semibold text-emerald-300 select-all tracking-wider">
        {show ? password : '••••••••'}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShow(!show);
        }}
        className="rounded p-0.5 text-zinc-400 hover:text-white hover:bg-white/10 transition"
        title={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff className="h-3.5 w-3.5 text-amber-400" /> : <Eye className="h-3.5 w-3.5 text-zinc-400" />}
      </button>
      <button
        type="button"
        onClick={copy}
        className="rounded p-0.5 text-zinc-400 hover:text-emerald-400 hover:bg-white/10 transition"
        title="Copy password to clipboard"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-zinc-400" />}
      </button>
    </div>
  );
}

/**
 * Direct Live Chat Modal
 * Enables staff to talk directly with any user without leaving User Management!
 */
function DirectChatModal({ modal, onClose }) {
  const open = modal?.type === 'chat';
  const u = modal?.user;
  const navigate = useNavigate();
  if (!open || !u) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <MessageSquare className="h-5 w-5 text-emerald-400" />
          <span>Direct Chat · @{u.username}</span>
          {u.is_online ? (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Active now
            </span>
          ) : (
            <span className="text-xs font-normal text-zinc-500">
              Last seen: {u.last_login_at ? timeAgo(u.last_login_at) : 'Never'}
            </span>
          )}
        </div>
      }
      wide
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-ink-900 p-3 text-xs text-zinc-400">
          <div>
            <b className="text-white">{u.full_name || u.username}</b> · Cash:{' '}
            <span className="font-mono font-semibold text-emerald-400">{usd(u.cash_balance)}</span>
            {u.active_package_name ? (
              <span>
                {' '}· Package: <b className="text-emerald-300">{u.active_package_name} (${Number(u.active_package_amount).toFixed(0)})</b>
              </span>
            ) : null}
          </div>
          <button
            onClick={() => {
              onClose();
              navigate(`/admin/support?user=${u.id}`);
            }}
            className="font-medium text-emerald-400 hover:text-emerald-300 hover:underline"
          >
            Open in Full Support Desk →
          </button>
        </div>

        <Chat
          path={`/admin/support/threads/${u.id}`}
          mineIsStaff={true}
          placeholder={`Type message to @${u.username}…`}
          height="h-[460px]"
        />
      </div>
    </Modal>
  );
}

function UserFormModal({ modal, onClose, onDone }) {
  const toast = useToast();
  const open = modal?.type === 'create' || modal?.type === 'edit';
  const editing = modal?.type === 'edit' ? modal.user : null;
  const [form, setForm] = useState({});
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNewPassword('');
    setForm(
      editing
        ? {
            username: editing.username,
            email: editing.email,
            phone: editing.phone || '',
            full_name: editing.full_name || '',
            role: editing.role,
            national_id: editing.national_id || '',
          }
        : {
            username: '',
            email: '',
            phone: '',
            full_name: '',
            role: 'customer',
            password: '',
          },
    );
  }, [open, editing]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let res = '';
    for (let i = 0; i < 12; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (editing) {
      setNewPassword(res);
    } else {
      setForm((f) => ({ ...f, password: res }));
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) {
        await api(`/admin/users/${editing.id}`, {
          method: 'PUT',
          body: { ...form, password: newPassword || undefined },
        });
        toast.success('User updated successfully');
      } else {
        await api('/admin/users', { method: 'POST', body: form });
        toast.success('User created successfully');
      }
      onDone();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit @${editing.username}` : 'Add new user'}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Username">
            <input className="input" required value={form.username || ''} onChange={set('username')} />
          </Field>
          <Field label="Role">
            <select className="input" value={form.role || 'customer'} onChange={set('role')}>
              <option value="customer">Customer</option>
              <option value="agent">Agent (Staff)</option>
              <option value="admin">Administrator</option>
            </select>
          </Field>
        </div>
        <Field label="Full name">
          <input className="input" value={form.full_name || ''} onChange={set('full_name')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email">
            <input className="input" type="email" required value={form.email || ''} onChange={set('email')} />
          </Field>
          <Field label="Phone">
            <input className="input" value={form.phone || ''} onChange={set('phone')} />
          </Field>
        </div>
        {editing ? (
          <>
            <Field label="National ID" hint="Each ID can be linked to only one account">
              <input className="input font-mono uppercase" value={form.national_id || ''} onChange={set('national_id')} />
            </Field>

            {/* Current Password Display */}
            <div className="rounded-xl border border-white/5 bg-ink-900 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Current Login Password:</span>
                <PasswordDisplay password={editing.plain_password} defaultHidden={false} />
              </div>
            </div>

            {/* Change Password */}
            <Field label="Set New Password (optional)" hint="Type a new password or generate one. Leave blank to keep current password.">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <KeyRound className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    className="input pl-9 font-mono"
                    type="text"
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password…"
                  />
                </div>
                <button
                  type="button"
                  onClick={generateRandomPassword}
                  className="btn btn-outline btn-sm text-xs"
                >
                  Generate
                </button>
              </div>
            </Field>
          </>
        ) : (
          <Field label="Initial password" hint="At least 6 characters. Displayed to admin and used for customer login.">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <KeyRound className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  className="input pl-9 font-mono"
                  type="text"
                  required
                  minLength={6}
                  value={form.password || ''}
                  onChange={set('password')}
                  placeholder="Create password…"
                />
              </div>
              <button
                type="button"
                onClick={generateRandomPassword}
                className="btn btn-outline btn-sm text-xs"
              >
                Generate
              </button>
            </div>
          </Field>
        )}
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy && <Spinner className="!text-ink-950" />} {editing ? 'Save Changes' : 'Create User'}
        </button>
      </form>
    </Modal>
  );
}

/**
 * Balance Control Modal
 * Supports both setting an exact target balance (e.g. $5,000) or applying a delta credit/debit.
 */
function BalanceControlModal({ modal, onClose, onDone }) {
  const toast = useToast();
  const open = modal?.type === 'balance' || modal?.type === 'adjust';
  const u = modal?.user;
  const [mode, setMode] = useState('set'); // 'set' | 'adjust'
  const [targetBalance, setTargetBalance] = useState('');
  const [adjustDir, setAdjustDir] = useState('credit');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const currentBal = Number(u?.cash_balance || 0);

  useEffect(() => {
    if (open && u) {
      setMode(modal?.type === 'adjust' ? 'adjust' : 'set');
      setTargetBalance(String(currentBal));
      setAdjustDir('credit');
      setAdjustAmount('');
      setReason('');
    }
  }, [open, u, modal?.type]);

  if (!open || !u) return null;

  const targetNum = Number(targetBalance) || 0;
  const delta = targetNum - currentBal;

  const submitSet = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/admin/users/${u.id}/set-balance`, {
        method: 'POST',
        body: {
          balance: targetNum,
          reason: reason || 'Administrative balance set',
        },
      });
      toast.success(`Cash balance for @${u.username} updated to ${usd(targetNum)}`);
      onDone();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const submitAdjust = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const signed = adjustDir === 'credit' ? Number(adjustAmount) : -Number(adjustAmount);
      await api(`/admin/users/${u.id}/adjust`, {
        method: 'POST',
        body: { amount: signed, reason: reason || 'Admin cash adjustment' },
      });
      toast.success(`Balance ${adjustDir === 'credit' ? 'credited' : 'debited'} by ${usd(adjustAmount)}`);
      onDone();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Control Cash Balance · @${u.username}`}>
      <div className="space-y-4">
        {/* Balance Status Banner */}
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-sm">
          <div>
            <div className="text-xs text-zinc-400">Current Cash Balance</div>
            <div className="font-mono text-xl font-bold text-emerald-400">{usd(currentBal)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-zinc-400">Invested Portfolio</div>
            <div className="font-mono text-sm font-semibold text-zinc-200">{usd(u.portfolio_value)}</div>
          </div>
        </div>

        {/* Mode Tabs */}
        <Tabs
          tabs={[
            ['set', '🎯 Set Exact Balance'],
            ['adjust', '± Credit / Debit Adjustment'],
          ]}
          value={mode}
          onChange={setMode}
        />

        {mode === 'set' ? (
          <form onSubmit={submitSet} className="space-y-4">
            <Field label="Set New Cash Balance (USD)" hint="Enter the exact amount you want the user's cash balance to be">
              <div className="relative">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 font-mono text-zinc-500 font-bold">$</span>
                <input
                  className="input pl-8 font-mono text-base font-semibold"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={targetBalance}
                  onChange={(e) => setTargetBalance(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </Field>

            {/* Quick Presets */}
            <div>
              <div className="mb-1.5 text-xs text-zinc-400">Quick Balance Presets:</div>
              <div className="flex flex-wrap gap-1.5">
                {[0, 100, 250, 500, 1000, 2500, 5000, 10000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTargetBalance(String(amt))}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-mono transition ${
                      targetNum === amt
                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 font-bold'
                        : 'border-white/10 bg-ink-900 text-zinc-300 hover:border-emerald-500/40 hover:text-white'
                    }`}
                  >
                    ${amt.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview Delta */}
            <div className="rounded-xl border border-white/5 bg-ink-900/80 p-3 text-xs">
              <div className="flex items-center justify-between text-zinc-400">
                <span>Calculated Change:</span>
                <span className={`font-mono font-bold text-sm ${delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-rose-400' : 'text-zinc-400'}`}>
                  {delta > 0 ? `+${usd(delta)} (Credit)` : delta < 0 ? `-${usd(Math.abs(delta))} (Debit)` : 'No change ($0.00)'}
                </span>
              </div>
            </div>

            <Field label="Reason & Audit Note" hint="Recorded in financial ledger and visible to user">
              <input
                className="input"
                maxLength={200}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Administrative balance set"
              />
            </Field>

            <button className="btn btn-primary w-full" disabled={busy}>
              {busy && <Spinner className="!text-ink-950" />} Update Balance to {usd(targetNum)}
            </button>
          </form>
        ) : (
          <form onSubmit={submitAdjust} className="space-y-4">
            <Tabs
              tabs={[
                ['credit', 'Credit (+) Add Funds'],
                ['debit', 'Debit (−) Deduct Funds'],
              ]}
              value={adjustDir}
              onChange={setAdjustDir}
            />
            <Field label="Adjustment Amount (USD)">
              <input
                className="input font-mono"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field label="Reason & Audit Note" hint="Required. Displayed in ledger and audit log">
              <input
                className="input"
                required
                minLength={5}
                maxLength={200}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Daily trade profit correction or promo bonus"
              />
            </Field>
            <button className="btn btn-primary w-full" disabled={busy}>
              {busy && <Spinner className="!text-ink-950" />} Apply {adjustDir === 'credit' ? 'Credit' : 'Debit'} Now
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}

/**
 * Package Control Modal
 * Assign, activate, change, or remove investment packages for any user.
 */
function PackageControlModal({ modal, onClose, onDone }) {
  const toast = useToast();
  const open = modal?.type === 'package';
  const u = modal?.user;
  const [selectedFundId, setSelectedFundId] = useState(1);
  const [packageAmount, setPackageAmount] = useState('250');
  const [chargeCash, setChargeCash] = useState(false);
  const [busy, setBusy] = useState(false);

  const PACKAGES = [
    {
      id: 1,
      name: 'Package 1 · Prime Liquidity & Yield (Income Fund)',
      short: 'Income Fund (Package 1)',
      min: 250,
      yield: '0.50% / trade task (1.00% daily in 2 tasks)',
      color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    },
    {
      id: 2,
      name: 'Package 2 · Balanced Multi-Asset Growth',
      short: 'Balanced Growth (Package 2)',
      min: 500,
      yield: '0.50% / trade task (1.00% daily in 2 tasks)',
      color: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    },
    {
      id: 3,
      name: 'Package 3 · Global Quantitative Macro (Global Equity)',
      short: 'Global Equity (Package 3)',
      min: 1000,
      yield: '0.50% / trade task (1.00% daily in 2 tasks)',
      color: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
    },
  ];

  useEffect(() => {
    if (open && u) {
      const activeId = Number(u.active_package_fund_id || 1);
      setSelectedFundId(activeId);
      setPackageAmount(String(u.active_package_invested || u.active_package_amount || 250));
      setChargeCash(false);
    }
  }, [open, u]);

  if (!open || !u) return null;

  const handleSelectPackage = (pkg) => {
    setSelectedFundId(pkg.id);
    if (Number(packageAmount) < pkg.min || !packageAmount) {
      setPackageAmount(String(pkg.min));
    }
  };

  const submitAssign = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/admin/users/${u.id}/package`, {
        method: 'POST',
        body: {
          fund_id: selectedFundId,
          amount: Number(packageAmount),
          charge_cash: chargeCash,
          action: 'assign',
        },
      });
      toast.success(`Package successfully activated for @${u.username}`);
      onDone();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const handleRemovePackage = async () => {
    if (!confirm(`Remove/deactivate all investment packages for @${u.username}?`)) return;
    setBusy(true);
    try {
      await api(`/admin/users/${u.id}/package`, {
        method: 'POST',
        body: { action: 'remove' },
      });
      toast.success(`Investment package removed for @${u.username}`);
      onDone();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Control Investment Package · @${u.username}`} wide>
      <div className="space-y-5">
        {/* Current Active Package Status */}
        <div className="rounded-xl border border-white/5 bg-ink-900 p-4">
          <div className="text-xs text-zinc-400">Current Active Package:</div>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <div>
              {u.active_package_name ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 font-semibold text-emerald-400">
                    <PackageCheck className="h-4 w-4" />
                    {u.active_package_name}
                  </span>
                  <span className="font-mono text-lg font-bold text-white">
                    ${Number(u.active_package_invested || u.active_package_amount || 0).toLocaleString()} Invested
                  </span>
                </div>
              ) : (
                <span className="text-sm font-medium text-zinc-400 italic">No package currently active</span>
              )}
            </div>

            {u.active_package_name && (
              <button
                type="button"
                onClick={handleRemovePackage}
                disabled={busy}
                className="btn btn-danger btn-sm"
              >
                Deactivate / Remove Package
              </button>
            )}
          </div>
        </div>

        {/* Package Selector */}
        <form onSubmit={submitAssign} className="space-y-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Select Investment Package to Assign / Update:
          </div>

          <div className="grid gap-2.5 sm:grid-cols-3">
            {PACKAGES.map((pkg) => {
              const active = selectedFundId === pkg.id;
              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => handleSelectPackage(pkg)}
                  className={`text-left rounded-xl border p-3.5 transition ${
                    active
                      ? `${pkg.color} ring-2 ring-emerald-500/50 shadow-lg`
                      : 'border-white/5 bg-ink-900/60 hover:border-white/20 text-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Package {pkg.id}</span>
                    {active && <Check className="h-4 w-4 text-emerald-400" />}
                  </div>
                  <div className="mt-1 font-semibold text-white text-sm">{pkg.short}</div>
                  <div className="mt-2 text-xs text-zinc-400">
                    Min: <b className="font-mono text-emerald-300">${pkg.min}</b>
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">{pkg.yield}</div>
                </button>
              );
            })}
          </div>

          {/* Amount Field */}
          <Field label="Package Amount (USD)" hint="Set package investment value. User earns 0.50% profit per daily trade task on this amount.">
            <div className="relative">
              <span className="absolute top-1/2 left-3 -translate-y-1/2 font-mono text-zinc-500 font-bold">$</span>
              <input
                className="input pl-8 font-mono text-base font-semibold"
                type="number"
                min="10"
                step="1"
                required
                value={packageAmount}
                onChange={(e) => setPackageAmount(e.target.value)}
                placeholder="250"
              />
            </div>
          </Field>

          {/* Amount Quick Presets */}
          <div className="flex flex-wrap gap-1.5">
            {[250, 500, 1000, 2500, 5000, 10000, 25000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setPackageAmount(String(amt))}
                className={`rounded-lg border px-2.5 py-1 text-xs font-mono transition ${
                  Number(packageAmount) === amt
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 font-bold'
                    : 'border-white/10 bg-ink-900 text-zinc-300 hover:border-emerald-500/40 hover:text-white'
                }`}
              >
                ${amt.toLocaleString()}
              </button>
            ))}
          </div>

          {/* Charge User Cash Option */}
          <label className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-ink-900 p-3 text-xs text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              className="checkbox"
              checked={chargeCash}
              onChange={(e) => setChargeCash(e.target.checked)}
            />
            <span>
              Deduct ${Number(packageAmount || 0).toLocaleString()} from user's cash balance (Current balance: <b>{usd(u.cash_balance)}</b>).
              <span className="block text-[11px] text-zinc-500">Leave unchecked to grant package directly without debiting user cash balance.</span>
            </span>
          </label>

          <button className="btn btn-primary w-full" disabled={busy}>
            {busy && <Spinner className="!text-ink-950" />}
            Assign & Activate ${Number(packageAmount || 0).toLocaleString()} Package for @{u.username}
          </button>
        </form>
      </div>
    </Modal>
  );
}

function UserDetailModal({ modal, onClose, onOpenBalance, onOpenPackage }) {
  const open = modal?.type === 'view';
  const [tab, setTab] = useState('activity');
  const { data, loading } = useApi(open ? `/admin/users/${modal.user.id}` : null);

  useEffect(() => {
    if (open) setTab('activity');
  }, [open, modal?.user?.id]);

  return (
    <Modal open={open} onClose={onClose} title={open ? `@${modal.user.username} · #${modal.user.id}` : ''} wide>
      {loading || !data ? (
        <Loading />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 text-sm sm:grid-cols-5">
            <div className="rounded-xl border border-white/5 bg-ink-900 p-3">
              <div className="text-[10px] text-zinc-500 uppercase">Full name</div>
              <div className="mt-0.5 font-semibold text-white truncate">{data.user.full_name || '—'}</div>
            </div>

            <div className="rounded-xl border border-white/5 bg-ink-900 p-3">
              <div className="text-[10px] text-zinc-500 uppercase">Cash balance</div>
              <div className="mt-0.5 font-semibold text-emerald-400 font-mono flex items-center justify-between">
                <span>{usd(data.user.cash_balance)}</span>
                <button
                  type="button"
                  onClick={() => onOpenBalance?.(data.user)}
                  className="text-[10px] text-emerald-400/80 hover:text-emerald-300 hover:underline font-sans"
                >
                  Manage →
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-ink-900 p-3">
              <div className="text-[10px] text-zinc-500 uppercase">Invested / Package</div>
              <div className="mt-0.5 font-semibold text-zinc-200 font-mono flex items-center justify-between">
                <span>{usd(data.user.portfolio_value)}</span>
                <button
                  type="button"
                  onClick={() => onOpenPackage?.(data.user)}
                  className="text-[10px] text-blue-400/80 hover:text-blue-300 hover:underline font-sans"
                >
                  Package →
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-ink-900 p-3">
              <div className="text-[10px] text-zinc-500 uppercase">Login Password</div>
              <div className="mt-1">
                <PasswordDisplay password={data.user.plain_password} defaultHidden={false} />
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-ink-900 p-3">
              <div className="text-[10px] text-zinc-500 uppercase">Last login</div>
              <div className="mt-0.5 text-xs text-zinc-300">{dateTime(data.user.last_login_at)}</div>
            </div>
          </div>

          {data.holdings.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.holdings.map((h) => (
                <span key={h.fund_id} className={`rounded-lg border px-3 py-1.5 text-xs ${RISK[h.risk_level]?.cls || 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'}`}>
                  {h.name}: {units(h.units)} units · {usd(h.value)}
                </span>
              ))}
            </div>
          )}

          <Tabs
            tabs={[
              ['activity', 'Activity'],
              ['tasks', `Daily Tasks (${data.tasks?.length || 0})`],
              ['ledger', `Ledger (${data.transactions.length})`],
              ['deposits', `Deposits (${data.deposits.length})`],
              ['withdrawals', `Withdrawals (${data.withdrawals.length})`],
              ['referrals', `Referrals (${data.referrals.length})`],
            ]}
            value={tab}
            onChange={setTab}
          />
          {tab === 'activity' && <UserActivity userId={data.user.id} />}
          {tab === 'tasks' && (
            <SimpleTable
              rows={data.tasks || []}
              cols={[
                ['Task Code', (t) => <span className="font-mono text-xs font-semibold text-emerald-400">{t.task_code || `#${t.task_id}`}</span>],
                ['Slot', (t) => <span className="text-xs font-medium text-zinc-300">Task {t.task_slot}</span>],
                ['Title', (t) => <div className="text-xs font-medium text-white max-w-[200px] truncate">{t.title}</div>],
                ['Profit Credited', (t) => <span className="font-mono text-xs font-bold text-emerald-400">{Number(t.reward_paid) > 0 ? usd(t.reward_paid) : `${Number(t.reward_pct || 0.5).toFixed(2)}%`}</span>],
                ['Status', (t) => <StatusBadge status={t.status} />],
                ['Completed', (t) => <span className="text-xs text-zinc-400">{dateTime(t.reviewed_at || t.created_at)}</span>],
              ]}
            />
          )}
          {tab === 'ledger' && <TxTable rows={data.transactions} />}
          {tab === 'deposits' && (
            <SimpleTable
              rows={data.deposits}
              cols={[
                ['#', (d) => `#${d.id}`],
                ['Amount', (d) => usd(d.amount)],
                ['Method', (d) => d.method],
                ['Status', (d) => <StatusBadge status={d.status} />],
                ['Date', (d) => dateTime(d.created_at)],
              ]}
            />
          )}
          {tab === 'withdrawals' && (
            <SimpleTable
              rows={data.withdrawals}
              cols={[
                ['#', (w) => `#${w.id}`],
                ['Amount', (w) => usd(w.amount)],
                ['Destination', (w) => w.destination],
                ['Status', (w) => <StatusBadge status={w.status} />],
                ['Date', (w) => dateTime(w.created_at)],
              ]}
            />
          )}
          {tab === 'referrals' && (
            <SimpleTable
              rows={data.referrals}
              cols={[
                ['ID', (r) => `#${r.id}`],
                ['Username', (r) => `@${r.username}`],
                ['Joined', (r) => date(r.created_at)],
              ]}
            />
          )}
        </div>
      )}
    </Modal>
  );
}

function SimpleTable({ rows, cols }) {
  if (!rows || rows.length === 0) return <Empty title="No records found" />;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {cols.map(([h]) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {cols.map(([h, fn]) => (
                <td key={h}>{fn(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
