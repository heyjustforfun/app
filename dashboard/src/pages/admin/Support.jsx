import { useEffect, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, MessageSquare, Plus, Search, User, X, CheckCircle, ShieldCheck } from 'lucide-react';
import { useApi } from '../../context/AppContext';
import { api, timeAgo, usd } from '../../lib/api';
import { Empty, Loading, StatusBadge } from '../../components/ui';
import Chat from '../../components/Chat';

export default function Support() {
  const { reloadStats, reloadNotes } = useOutletContext();
  const [params, setParams] = useSearchParams();
  const selected = Number(params.get('user')) || null;
  const threads = useApi('/admin/support/threads');
  const [filter, setFilter] = useState('');
  const [info, setInfo] = useState(null);

  // New Chat Modal state
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Refresh thread list periodically
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === 'visible' && threads.reload(), 6000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setInfo(null);
    if (selected) {
      api(`/admin/support/threads/${selected}?after=999999999999`)
        .then((d) => setInfo(d.user))
        .catch(() => {});
    }
  }, [selected]);

  // Load registered customers when new chat modal opens
  const openNewChat = async () => {
    setShowNewChatModal(true);
    setUserSearch('');
    if (allUsers.length === 0) {
      setLoadingUsers(true);
      try {
        const res = await api('/admin/support/users');
        setAllUsers(res.users || []);
      } catch {
        // Fallback to general users list if needed
        try {
          const res = await api('/admin/users?limit=300');
          setAllUsers(res.users || []);
        } catch {
          /* ignore */
        }
      } finally {
        setLoadingUsers(false);
      }
    }
  };

  const list = (threads.data?.threads || []).filter(
    (t) =>
      !filter ||
      t.username.toLowerCase().includes(filter.toLowerCase()) ||
      (t.email && t.email.toLowerCase().includes(filter.toLowerCase())) ||
      (t.full_name && t.full_name.toLowerCase().includes(filter.toLowerCase())),
  );

  const filteredUsers = allUsers.filter(
    (u) =>
      !userSearch ||
      u.username?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(userSearch.toLowerCase()),
  );

  return (
    <div className="card grid h-[calc(100vh-8.5rem)] max-h-[calc(100vh-8.5rem)] min-h-[480px] overflow-hidden md:grid-cols-[320px_1fr]">
      {/* Sidebar: Conversation List */}
      <aside className={`flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-r border-white/5 bg-ink-950/30 ${selected ? 'hidden md:flex' : 'flex'}`}>
        {/* Header & Controls */}
        <div className="shrink-0 border-b border-white/5 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Conversations</span>
            <button
              type="button"
              onClick={openNewChat}
              className="inline-flex items-center gap-1 rounded-lg bg-green-500/15 border border-green-500/30 px-2.5 py-1 text-xs font-bold text-green-400 hover:bg-green-500 hover:text-ink-950 transition active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Chat</span>
            </button>
          </div>

          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              className="input pl-9 text-xs"
              placeholder="Search conversations…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>

        {/* Conversation Items */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {threads.loading && !threads.data ? (
            <Loading />
          ) : list.length === 0 ? (
            <div className="p-6 text-center text-sm text-zinc-500">
              <MessageSquare className="mx-auto mb-2 h-7 w-7 text-zinc-600" />
              <p className="font-semibold text-zinc-400">No active conversations found</p>
              <button
                type="button"
                onClick={openNewChat}
                className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-green-400 hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Start a new chat with an investor
              </button>
            </div>
          ) : (
            list.map((t) => {
              const isSelected = selected === t.user_id;
              const hasLastMsg = Boolean(t.last_body || t.attachment_name);
              const preview = t.attachment_name
                ? `📎 ${t.attachment_name}`
                : t.last_body || 'No messages yet · Click to chat';

              return (
                <button
                  key={t.user_id}
                  onClick={() => setParams({ user: t.user_id })}
                  className={`block w-full border-b border-white/[0.04] px-4 py-3 text-left transition hover:bg-white/[0.04] ${
                    isSelected ? 'bg-green-500/10 border-l-2 border-l-green-400' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-white">@{t.username}</span>
                    {t.unread > 0 && (
                      <span className="rounded-full bg-green-500 px-1.5 text-[10px] font-bold text-ink-950">
                        {t.unread}
                      </span>
                    )}
                    {t.last_at && (
                      <span className="ml-auto text-[10px] text-zinc-500">{timeAgo(t.last_at)}</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className={`truncate text-xs ${hasLastMsg ? 'text-zinc-400' : 'text-zinc-600 italic'}`}>
                      {t.last_is_staff ? 'You: ' : ''}
                      {preview}
                    </p>
                    {t.cash_balance > 0 && (
                      <span className="shrink-0 text-[10px] font-mono text-zinc-500">{usd(t.cash_balance)}</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Main: Active Chat Window */}
      <section className={`flex h-full min-h-0 min-w-0 flex-col overflow-hidden ${selected ? 'flex' : 'hidden md:flex'}`}>
        {selected ? (
          <>
            <header className="shrink-0 flex flex-wrap items-center gap-3 border-b border-white/5 bg-ink-900/60 px-4 py-3">
              <button
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white md:hidden"
                onClick={() => setParams({})}
                title="Back to conversation list"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">@{info ? info.username : `User #${selected}`}</span>
                  {info?.full_name && <span className="text-xs text-zinc-400">({info.full_name})</span>}
                  <span className="live-dot" />
                </div>
                {info && (
                  <div className="text-xs text-zinc-400 truncate">
                    {info.email} {info.phone ? `· ${info.phone}` : ''} · Balance: <strong className="text-green-400 font-semibold">{usd(info.cash_balance)}</strong>
                  </div>
                )}
              </div>
              {info && <StatusBadge status={info.kyc_status} />}
              <Link to={`/admin/users?q=${info?.username || selected}`} className="btn btn-ghost btn-sm text-xs">
                User Details
              </Link>
            </header>

            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <Chat
                key={selected}
                path={`/admin/support/threads/${selected}`}
                mineIsStaff
                placeholder="Type your message, add emojis or drop files to reply…"
                height="h-full min-h-0 flex-1"
                onActivity={() => {
                  threads.reload();
                  reloadStats();
                  reloadNotes();
                }}
              />
            </div>
          </>
        ) : (
          <div className="m-auto flex flex-col items-center justify-center p-8 text-center max-w-sm">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-green-500/10 text-green-400 mb-4 shadow-lg">
              <MessageSquare className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-white">Admin Support Desk</h3>
            <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
              Select an ongoing conversation on the left, or start a new chat with any registered investor.
            </p>
            <button
              type="button"
              onClick={openNewChat}
              className="mt-5 btn btn-primary inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              <span>Start New Chat</span>
            </button>
          </div>
        )}
      </section>

      {/* New Chat Modal: Search Any Registered Investor */}
      <AnimatePresence>
        {showNewChatModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            onClick={() => setShowNewChatModal(false)}
          >
            <div
              className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-ink-950 p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-green-500/15 text-green-400">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Start New Conversation</h3>
                    <p className="text-[11px] text-zinc-400">Choose any registered investor to open a live chat session</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(false)}
                  className="rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="mt-4 relative">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  className="input pl-9 text-sm"
                  placeholder="Search by username, email or full name…"
                  value={userSearch}
                  autoFocus
                  onChange={(e) => setUserSearch(e.target.value)}
                />
              </div>

              {/* User List */}
              <div className="mt-3 max-h-80 overflow-y-auto divide-y divide-white/[0.04] rounded-xl border border-white/5 bg-ink-900/40">
                {loadingUsers ? (
                  <div className="py-8">
                    <Loading />
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="p-8 text-center text-xs text-zinc-500">No matching investors found</div>
                ) : (
                  filteredUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setParams({ user: u.id });
                        setShowNewChatModal(false);
                      }}
                      className="flex w-full items-center justify-between p-3 text-left transition hover:bg-white/[0.05]"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-white">@{u.username}</span>
                          {u.full_name && <span className="text-xs text-zinc-400">({u.full_name})</span>}
                        </div>
                        <div className="truncate text-xs text-zinc-500">{u.email}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-mono font-bold text-green-400">{usd(u.cash_balance)}</div>
                        <div className="text-[10px] text-zinc-500 capitalize">{u.status || 'Active'}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
