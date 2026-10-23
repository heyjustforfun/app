import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  Clock,
  Copy,
  DollarSign,
  ExternalLink,
  Eye,
  FileText,
  ListPlus,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useApi, useToast } from '../../context/AppContext';
import { api, dateTime, timeAgo, usd } from '../../lib/api';
import { Badge, Card, Empty, ErrorBox, Field, Loading, Modal, Spinner, StatCard, StatusBadge, Tabs } from '../../components/ui';

export default function TaskManagement() {
  const { reloadStats } = useOutletContext();
  const toast = useToast();

  const [dateFilter, setDateFilter] = useState('today');
  const [tab, setTab] = useState('submissions');
  const [subStatus, setSubStatus] = useState('pending');

  const todayStr = new Date().toISOString().slice(0, 10);
  const activeDate = dateFilter === 'today' ? todayStr : dateFilter === 'all' ? 'all' : dateFilter;

  const { data, loading, error, reload } = useApi(`/admin/tasks?date=${activeDate}&status=all`);
  const {
    data: subData,
    loading: subLoading,
    error: subError,
    reload: reloadSubs,
  } = useApi(`/admin/tasks/submissions?status=${subStatus}`);

  // Modals state
  const [taskModal, setTaskModal] = useState(null); // null | { mode: 'create' | 'edit', task?: object }
  const [reviewModal, setReviewModal] = useState(null); // null | { sub, action: 'approve' | 'reject' }
  const [quickModal, setQuickModal] = useState(false);
  const [dispatchModal, setDispatchModal] = useState(null); // task object
  const [dispatchTarget, setDispatchTarget] = useState('all');
  const [proofPreview, setProofPreview] = useState(null);

  const [quickTargetPackage, setQuickTargetPackage] = useState('all');

  const generateTaskCode = () => `TSK-${Math.floor(100000 + Math.random() * 900000)}`;

  const [form, setForm] = useState({
    task_code: generateTaskCode(),
    title: '',
    description: '',
    instructions: '',
    link_url: '',
    reward_mode: 'percent_investment',
    reward_pct: '1.000',
    reward_amount: '1.25',
    trade_duration_seconds: 30,
    expire_minutes: 180,
    task_date: todayStr,
    task_slot: 1,
    target_type: 'all',
    target_package: 'all',
    target_user_id: '',
    requires_proof: false,
    status: 'active',
    notify_users: true,
  });

  const [reviewNote, setReviewNote] = useState('');
  const [busy, setBusy] = useState(false);

  // Open create modal
  const openCreate = (slot = 1) => {
    setForm({
      task_code: generateTaskCode(),
      title: '',
      description: '',
      instructions: '',
      link_url: '',
      reward_mode: 'percent_investment',
      reward_pct: '1.000',
      reward_amount: '1.25',
      trade_duration_seconds: 30,
      expire_minutes: 180,
      task_date: todayStr,
      task_slot: slot,
      target_type: 'all',
      target_package: 'all',
      target_user_id: '',
      requires_proof: false,
      status: 'active',
      notify_users: true,
    });
    setTaskModal({ mode: 'create' });
  };

  // Open edit modal
  const openEdit = (t) => {
    setForm({
      id: t.id,
      task_code: t.task_code || `TSK-${t.id}`,
      title: t.title || '',
      description: t.description || '',
      instructions: t.instructions || '',
      link_url: t.link_url || '',
      reward_mode: t.reward_mode || 'percent_investment',
      reward_pct: String(t.reward_pct || '1.000'),
      reward_amount: String(t.reward_amount || '1.25'),
      trade_duration_seconds: Number(t.trade_duration_seconds || 30),
      expire_minutes: Number(t.expire_minutes || 180),
      task_date: t.task_date || todayStr,
      task_slot: t.task_slot || 1,
      target_type: t.target_type || 'all',
      target_package: t.target_package || (t.target_type === 'specific' ? 'specific' : 'all'),
      target_user_id: t.target_user_id ? String(t.target_user_id) : '',
      requires_proof: Boolean(t.requires_proof),
      status: t.status || 'active',
      notify_users: false,
    });
    setTaskModal({ mode: 'edit', task: t });
  };

  // Submit task create/edit form
  const handleSaveTask = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...form,
        target_type: form.target_package === 'specific' ? 'specific' : 'all',
      };
      if (taskModal.mode === 'create') {
        await api('/admin/tasks', { method: 'POST', body: payload });
        toast.success(`Daily task "${form.task_code}" created successfully`);
      } else {
        await api(`/admin/tasks/${form.id}`, { method: 'PUT', body: payload });
        toast.success(`Daily task "${form.task_code}" updated`);
      }
      setTaskModal(null);
      reload();
      reloadStats();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  // Quick generate 2 daily tasks for today
  const handleQuickGenerate = async () => {
    setBusy(true);
    try {
      const res = await api('/admin/tasks/quick-generate', {
        method: 'POST',
        body: {
          task_date: todayStr,
          target_package: quickTargetPackage,
          trade_duration_seconds: 30,
          expire_minutes: 180,
          notify_users: true,
        },
      });
      toast.success(`Generated ${res.created_count} daily tasks (1.00% daily profit package) for today!`);
      setQuickModal(false);
      reload();
      reloadStats();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  // Delete task
  const handleDeleteTask = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete task "${title}"?`)) return;
    try {
      await api(`/admin/tasks/${id}`, { method: 'DELETE' });
      toast.success('Task deleted');
      reload();
      reloadStats();
    } catch (err) {
      toast.error(err);
    }
  };

  // Submit submission review
  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/admin/tasks/submissions/${reviewModal.sub.id}/review`, {
        method: 'POST',
        body: { action: reviewModal.action, admin_note: reviewNote },
      });
      toast.success(
        reviewModal.action === 'approve'
          ? `Submission #${reviewModal.sub.id} approved and reward credited!`
          : `Submission #${reviewModal.sub.id} rejected.`,
      );
      setReviewModal(null);
      setReviewNote('');
      reloadSubs();
      reload();
      reloadStats();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  // Dispatch existing task to targeted users (Package 1, Package 2, Package 3, Any, or All)
  const handleDispatch = async (e) => {
    e?.preventDefault?.();
    if (!dispatchModal) return;
    setBusy(true);
    try {
      const res = await api(`/admin/tasks/${dispatchModal.id}/dispatch`, {
        method: 'POST',
        body: { target_package: dispatchTarget },
      });
      toast.success(`Task ${res.task_code || dispatchModal.task_code} dispatched to ${res.recipient_count} user(s) via notification and chat!`);
      setDispatchModal(null);
      reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const stats = data?.stats;
  const pendingCount = stats?.submissions_pending || 0;

  return (
    <div className="space-y-6">
      {/* Header and Quick Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2.5 text-2xl font-bold text-white">
            <CheckSquare className="h-6 w-6 text-green-400" /> Daily Task Management Desk
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Publish daily tasks for investors, assign slots, incentivize engagement, and review submitted verification proofs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button onClick={() => setQuickModal(true)} className="btn btn-outline btn-sm !px-3.5 !py-2 text-green-400 border-green-500/30 hover:bg-green-500/10">
            <Sparkles className="h-4 w-4 text-green-400" /> Quick 2 Tasks for Today
          </button>
          <button onClick={() => openCreate(1)} className="btn btn-primary btn-sm !px-3.5 !py-2">
            <Plus className="h-4 w-4" /> Create Daily Task
          </button>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          index={0}
          label="Today's Tasks"
          value={stats ? stats.tasks_today : '—'}
          valueClass="text-green-400"
          icon={Calendar}
          tone="green"
          hint={`Scheduled for date: ${todayStr}`}
        />
        <StatCard
          index={1}
          label="Pending Submissions"
          value={stats ? stats.submissions_pending : '—'}
          valueClass={pendingCount > 0 ? 'text-amber-400 animate-pulse' : 'text-zinc-300'}
          icon={Clock}
          tone="amber"
          hint={pendingCount > 0 ? 'Awaiting staff verification' : 'All submissions clear'}
        />
        <StatCard
          index={2}
          label="Approved Submissions"
          value={stats ? stats.approved_all_time : '—'}
          valueClass="text-sky-400"
          icon={CheckCircle2}
          tone="blue"
          hint="Investor tasks completed all-time"
        />
        <StatCard
          index={3}
          label="Total Rewards Paid"
          value={stats ? usd(stats.total_rewards_paid) : '—'}
          valueClass="text-amber-400"
          icon={DollarSign}
          tone="amber"
          hint="Cash credited to investor balances"
        />
      </div>

      {/* Main Tabs Container */}
      <Card
        title={tab === 'submissions' ? 'Task Submissions Review Queue' : 'Active Daily Tasks Catalog'}
        subtitle={
          tab === 'submissions'
            ? 'Verify investor task submissions, inspect attached proof documents, and release rewards.'
            : 'Configure daily tasks, target specific audiences, and set task reward amounts.'
        }
        icon={tab === 'submissions' ? Clock : ListPlus}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Tabs
              tabs={[
                ['submissions', `Review Queue ${pendingCount > 0 ? `(${pendingCount})` : ''}`],
                ['tasks', `Manage Tasks (${data?.tasks?.length || 0})`],
              ]}
              value={tab}
              onChange={setTab}
            />
          </div>
        }
      >
        {/* SUBMISSIONS TAB */}
        {tab === 'submissions' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
              <Tabs
                tabs={[
                  ['pending', 'Pending Review'],
                  ['approved', 'Approved'],
                  ['rejected', 'Rejected'],
                  ['all', 'All Submissions'],
                ]}
                value={subStatus}
                onChange={setSubStatus}
              />
              <button onClick={() => reloadSubs()} className="btn btn-ghost btn-sm text-zinc-400 hover:text-white" title="Refresh submissions">
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </button>
            </div>

            {subLoading && !subData ? (
              <Loading />
            ) : subError ? (
              <ErrorBox error={subError} onRetry={reloadSubs} />
            ) : !subData?.submissions?.length ? (
              <Empty
                title={`No ${subStatus} submissions found`}
                text={subStatus === 'pending' ? 'All pending user task submissions have been reviewed.' : undefined}
              />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Investor</th>
                      <th>Task Details</th>
                      <th>Reward</th>
                      <th>Proof & Note</th>
                      <th>Submitted</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subData.submissions.map((s) => (
                      <tr key={s.id}>
                        <td className="font-mono text-xs text-zinc-500">#{s.id}</td>
                        <td>
                          <div className="font-semibold text-white">@{s.username}</div>
                          <div className="text-[11px] text-zinc-500">{s.email}</div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] font-bold text-zinc-400">
                              Task #{s.task_slot}
                            </span>
                            <span className="font-medium text-white">{s.task_title}</span>
                          </div>
                          <div className="mt-0.5 text-[11px] text-zinc-500">Date: {s.task_date}</div>
                        </td>
                        <td className="font-mono font-bold text-amber-400">{usd(s.reward_amount)}</td>
                        <td>
                          <div className="max-w-xs space-y-1">
                            {s.proof_text ? (
                              <p className="line-clamp-2 text-xs text-zinc-300">{s.proof_text}</p>
                            ) : (
                              <span className="text-xs text-zinc-500 italic">No note provided</span>
                            )}
                            {s.proof_file && (
                              <button
                                onClick={() => setProofPreview(s)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-400 hover:text-sky-300 underline"
                              >
                                <Eye className="h-3 w-3" /> View Proof Document
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="text-xs text-zinc-400" title={dateTime(s.created_at)}>
                          {timeAgo(s.created_at)}
                        </td>
                        <td>
                          <StatusBadge status={s.status} />
                          {s.admin_note && <div className="mt-0.5 max-w-xs truncate text-[10px] text-zinc-500">Note: {s.admin_note}</div>}
                        </td>
                        <td className="text-right">
                          {s.status === 'pending' ? (
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setReviewModal({ sub: s, action: 'approve' });
                                  setReviewNote('');
                                }}
                                className="btn btn-primary btn-sm !px-2.5 !py-1"
                                title="Approve & Credit Reward"
                              >
                                <Check className="h-3.5 w-3.5" /> Approve
                              </button>
                              <button
                                onClick={() => {
                                  setReviewModal({ sub: s, action: 'reject' });
                                  setReviewNote('');
                                }}
                                className="btn btn-warn btn-sm !px-2.5 !py-1"
                                title="Reject"
                              >
                                <X className="h-3.5 w-3.5" /> Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-500 font-mono">
                              {s.reviewed_by ? `Reviewed by @${s.reviewer_username || 'admin'}` : '—'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* MANAGE TASKS TAB */}
        {tab === 'tasks' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">Filter Date:</span>
                <Tabs
                  tabs={[
                    ['today', 'Today'],
                    ['all', 'All Dates'],
                  ]}
                  value={dateFilter}
                  onChange={setDateFilter}
                />
              </div>
              <button onClick={() => reload()} className="btn btn-ghost btn-sm text-zinc-400 hover:text-white" title="Refresh tasks">
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </button>
            </div>

            {loading && !data ? (
              <Loading />
            ) : error ? (
              <ErrorBox error={error} onRetry={reload} />
            ) : !data?.tasks?.length ? (
              <Empty
                title={`No tasks found for ${dateFilter === 'today' ? 'today' : 'the selected filter'}`}
                text="Click 'Quick 2 Tasks for Today' or 'Create Daily Task' above to start issuing daily tasks to investors."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {data.tasks.map((t) => (
                  <div
                    key={t.id}
                    className="relative flex flex-col justify-between rounded-xl border border-white/5 bg-ink-900/60 p-4 transition hover:border-white/10"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-md border border-green-500/30 bg-green-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-green-400">
                            Task #{t.task_slot}
                          </span>
                          <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-cyan-300">
                            {t.task_code || `TSK-${t.id}`}
                          </span>
                          <span className="text-xs text-zinc-500">Date: {t.task_date}</span>
                          <StatusBadge status={t.status} />
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-sm font-bold text-amber-400">
                            {t.reward_mode === 'percent_investment' ? `${Number(t.reward_pct || 0.5).toFixed(2)}% Yield` : usd(t.reward_amount)}
                          </span>
                          {t.reward_mode === 'percent_investment' && (
                            <div className="text-[10px] text-zinc-400 font-medium">2 tasks = 1% daily</div>
                          )}
                        </div>
                      </div>

                      <h3 className="mt-2 text-base font-semibold text-white">{t.title}</h3>
                      {t.description && <p className="mt-1 text-xs text-zinc-400 leading-relaxed">{t.description}</p>}

                      {t.link_url && (
                        <div className="mt-2 flex items-center gap-1 text-[11px] text-sky-400">
                          <ExternalLink className="h-3 w-3" />
                          <span>Link: {t.link_url}</span>
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                        <span className="rounded bg-white/5 px-2 py-0.5 border border-white/10 text-white font-medium">
                          🎯 {t.target_package === 'package_1'
                            ? 'Package 1 ($250 Starter)'
                            : t.target_package === 'package_2'
                            ? 'Package 2 ($500 Growth)'
                            : t.target_package === 'package_3'
                            ? 'Package 3 ($1000 Elite)'
                            : t.target_package === 'any_package'
                            ? 'Any Active Package'
                            : t.target_type === 'specific'
                            ? `@${t.target_username || t.target_user_id}`
                            : 'All Investors'}
                        </span>
                        <span className="rounded bg-white/5 px-2 py-0.5 text-zinc-300">
                          ⏱️ {t.trade_duration_seconds || 30}s Trade
                        </span>
                        <span className="rounded bg-white/5 px-2 py-0.5 text-zinc-300">
                          ⏳ {(t.expire_minutes || 180) >= 60 ? `${Math.round((t.expire_minutes || 180) / 60 * 10) / 10}h (${t.expire_minutes || 180}m)` : `${t.expire_minutes || 180}m`} Expire Window
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-zinc-500">Submissions:</span>
                        <span className="font-bold text-white">{t.total_submissions}</span>
                        {t.pending_submissions > 0 && (
                          <span className="rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-bold text-amber-300">
                            {t.pending_submissions} pending
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setDispatchModal(t);
                            setDispatchTarget(t.target_package || 'all');
                          }}
                          className="btn btn-outline btn-sm !px-2.5 !py-1 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10 inline-flex items-center gap-1.5 text-xs font-semibold"
                          title="Send task code to users via notification & chat"
                        >
                          <Send className="h-3 w-3" />
                          <span>Send to Users</span>
                        </button>
                        <button onClick={() => openEdit(t)} className="btn btn-ghost btn-sm !p-1.5 text-zinc-400 hover:text-white" title="Edit Task">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTask(t.id, t.title)}
                          className="btn btn-ghost btn-sm !p-1.5 text-zinc-400 hover:text-rose-400"
                          title="Delete Task"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* CREATE / EDIT TASK MODAL */}
      <Modal
        open={Boolean(taskModal)}
        onClose={() => setTaskModal(null)}
        title={taskModal?.mode === 'create' ? 'Create Daily Task' : `Edit Task #${form.id}`}
        wide
      >
        <form onSubmit={handleSaveTask} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Unique Task Code" hint="Unique ID identifier for this trade task">
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input font-mono font-bold text-cyan-300 uppercase"
                  required
                  value={form.task_code}
                  onChange={(e) => setForm({ ...form, task_code: e.target.value.toUpperCase() })}
                  placeholder="TSK-104928"
                />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, task_code: generateTaskCode() })}
                  className="btn btn-ghost btn-sm border border-white/10 shrink-0 text-xs"
                  title="Generate new random ID"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </Field>

            <Field label="Task Slot & Order" hint="Task sequence (1, 2 = daily 1% profit package)">
              <select
                className="input"
                value={form.task_slot}
                onChange={(e) => setForm({ ...form, task_slot: Number(e.target.value) })}
              >
                <option value={1}>Slot 1 (Daily Task 1 - 0.50% Profit)</option>
                <option value={2}>Slot 2 (Daily Task 2 - 0.50% Profit)</option>
                <option value={3}>Slot 3 (Bonus Task)</option>
                <option value={4}>Slot 4</option>
              </select>
            </Field>

            <Field label="Task Scheduled Date" hint="Which day this task applies to">
              <input
                type="date"
                className="input"
                required
                value={form.task_date}
                onChange={(e) => setForm({ ...form, task_date: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Task Title" hint="Clear, actionable task summary">
            <input
              type="text"
              className="input"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Alpha Scalp Arbitrage - 30s Live Trade Session #1"
            />
          </Field>

          {/* PACKAGE TARGETING SECTION */}
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-3">
            <div className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="h-4 w-4" /> Target Audience & Activated Package Filter
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Send Task To" hint="Target specific package activations or all users">
                <select
                  className="input font-semibold"
                  value={form.target_package}
                  onChange={(e) => setForm({ ...form, target_package: e.target.value })}
                >
                  <option value="all">🌐 All Registered Investors</option>
                  <option value="package_1">🥉 Package 1: Basic Starter ($250 Holding)</option>
                  <option value="package_2">🥈 Package 2: Standard Growth ($500 Holding)</option>
                  <option value="package_3">🥇 Package 3: Executive Elite ($1000 Holding)</option>
                  <option value="any_package">💎 Any Active Investor (Has Active Package)</option>
                  <option value="specific">👤 Specific Investor User ID</option>
                </select>
              </Field>

              {form.target_package === 'specific' ? (
                <Field label="Target Investor User ID" hint="Enter numerical user ID">
                  <input
                    type="number"
                    className="input font-mono"
                    required
                    value={form.target_user_id}
                    onChange={(e) => setForm({ ...form, target_user_id: e.target.value })}
                    placeholder="e.g. 5"
                  />
                </Field>
              ) : (
                <Field label="Task Status" hint="Active tasks display on customer dashboard">
                  <select
                    className="input"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="active">Active (Visible)</option>
                    <option value="inactive">Inactive</option>
                    <option value="archived">Archived</option>
                  </select>
                </Field>
              )}
            </div>
          </div>

          {/* TRADE TIME & EXPIRATION SECTION */}
          <div className="grid gap-4 sm:grid-cols-2 rounded-xl border border-white/5 bg-ink-950 p-4">
            <Field label="Trade Execution Time (Seconds)" hint="Duration of the live trading animation (default 30s)">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="5"
                  max="3600"
                  className="input font-mono font-bold text-amber-300"
                  required
                  value={form.trade_duration_seconds}
                  onChange={(e) => setForm({ ...form, trade_duration_seconds: Number(e.target.value) })}
                />
                <span className="text-xs text-zinc-400 font-semibold shrink-0">Seconds</span>
              </div>
            </Field>

            <Field label="Expire Time (Minutes)" hint="How long until this task window expires (default 180m = 3 Hours)">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="10080"
                  className="input font-mono font-bold text-rose-300"
                  required
                  value={form.expire_minutes}
                  onChange={(e) => setForm({ ...form, expire_minutes: Number(e.target.value) })}
                />
                <span className="text-xs text-zinc-400 font-semibold shrink-0">
                  Minutes {form.expire_minutes ? `(${Math.round(form.expire_minutes / 60 * 10) / 10}h)` : ''}
                </span>
              </div>
            </Field>
          </div>

          {/* PROFIT / YIELD SECTION */}
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 space-y-3">
            <div className="text-xs font-bold text-green-400 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="h-4 w-4" /> Profit Yield & Daily Reward Model
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Reward Mode" hint="Select percentage yield or fixed cash amount">
                <select
                  className="input font-semibold"
                  value={form.reward_mode}
                  onChange={(e) => setForm({ ...form, reward_mode: e.target.value })}
                >
                  <option value="percent_investment">
                    1.00% Gross Trade per Task (50% User / 50% Company = 0.50% Net Daily per Task)
                  </option>
                  <option value="fixed">Fixed Cash Amount ($ USD)</option>
                </select>
              </Field>

              {form.reward_mode === 'percent_investment' ? (
                <Field label="Gross Trade Percentage (%)" hint="Default 1.000% gross trade (split 50% user / 50% company)">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.001"
                      min="0.01"
                      className="input font-mono font-bold text-green-400"
                      required
                      value={form.reward_pct}
                      onChange={(e) => setForm({ ...form, reward_pct: e.target.value })}
                    />
                    <span className="text-xs text-green-300 font-bold shrink-0">%</span>
                  </div>
                </Field>
              ) : (
                <Field label="Fixed Cash Reward ($ USD)" hint="Cash credited upon completion">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input font-mono font-bold text-amber-400"
                    required
                    value={form.reward_amount}
                    onChange={(e) => setForm({ ...form, reward_amount: e.target.value })}
                  />
                </Field>
              )}
            </div>
            {form.reward_mode === 'percent_investment' && (
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                💡 <strong>1.00% Daily Profit Rule:</strong> Each daily task executes a 1.00% gross trade on the user's total account balance (e.g. $11.00 on $1,100), split 50% to user ($5.50) and 50% to company ($5.50). Completing both tasks pays the user 1.00% net daily profit ($11.00 total on $1,100 balance).
              </p>
            )}
          </div>

          <Field label="Task Description" hint="Explain the trade opportunity to investors">
            <textarea
              className="input !h-20"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Execute 30-second liquidity pool arbitrage trade session. 2 daily tasks yield 1.00% daily profit on your active investment."
            />
          </Field>

          <Field label="Instructions & Steps" hint="Specific steps for the investor">
            <textarea
              className="input !h-20"
              value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              placeholder="Click Start Trade, monitor the 30-second live order routing countdown, and receive your 0.50% profit yield instantly."
            />
          </Field>

          <Field label="Internal Link / Action URL" hint="Optional relative route in dashboard">
            <input
              type="text"
              className="input"
              value={form.link_url}
              onChange={(e) => setForm({ ...form, link_url: e.target.value })}
              placeholder="e.g. /trade or /funds"
            />
          </Field>

          <div className="flex flex-wrap items-center gap-6 rounded-xl border border-white/5 bg-ink-900 p-3">
            <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                className="checkbox"
                checked={form.requires_proof}
                onChange={(e) => setForm({ ...form, requires_proof: e.target.checked })}
              />
              Require Manual Verification Proof (Leave unchecked for instant 30s trade profit)
            </label>

            {taskModal?.mode === 'create' && (
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={form.notify_users}
                  onChange={(e) => setForm({ ...form, notify_users: e.target.checked })}
                />
                Send In-App Notification to Targeted Investors
              </label>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
            <button type="button" onClick={() => setTaskModal(null)} className="btn btn-ghost" disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? <Spinner /> : null}
              {taskModal?.mode === 'create' ? 'Create Task' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* QUICK 2 TASKS GENERATOR MODAL */}
      <Modal open={quickModal} onClose={() => setQuickModal(false)} title="Quick Create 2 Daily Tasks for Today">
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-green-500/20 bg-green-500/20 p-4 text-sm text-green-300">
            <Sparkles className="h-5 w-5 shrink-0 text-green-400" />
            <div>
              <div className="font-semibold text-white">1.00% Daily Profit Trade Package</div>
              <p className="mt-1 text-xs text-zinc-300">
                Instantly generates today's 2 daily tasks with <strong>30-second live trade execution</strong> and <strong>3-hour expiration (180 minutes)</strong>. Each task runs a <strong>1.00% gross trade</strong> with a <strong>50/50 profit split</strong>, delivering <strong>1.00% net daily profit</strong> to the investor across 2 tasks!
              </p>
            </div>
          </div>

          <Field label="Target Audience Package" hint="Select which investors receive these 2 tasks">
            <select
              className="input font-semibold"
              value={quickTargetPackage}
              onChange={(e) => setQuickTargetPackage(e.target.value)}
            >
              <option value="all">🌐 All Registered Investors</option>
              <option value="package_1">🥉 Package 1: Basic Starter ($250)</option>
              <option value="package_2">🥈 Package 2: Standard Growth ($500)</option>
              <option value="package_3">🥇 Package 3: Executive Elite ($1000)</option>
              <option value="any_package">💎 Any Active Investor (Holdings over $0)</option>
            </select>
          </Field>

          <div className="space-y-2 rounded-xl border border-white/5 bg-ink-900 p-3 text-xs">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex items-center gap-2">
                <Badge tone="green">Task 1 (30s)</Badge>
                <span className="font-semibold text-white">High-Frequency Arbitrage Trade #1</span>
              </div>
              <span className="font-mono text-green-400 font-bold">+0.50% Net (1.00% Trade)</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <Badge tone="green">Task 2 (30s)</Badge>
                <span className="font-semibold text-white">Decentralized Market Maker Trade #2</span>
              </div>
              <span className="font-mono text-green-400 font-bold">+0.50% Net (1.00% Trade)</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
            <button type="button" onClick={() => setQuickModal(false)} className="btn btn-ghost" disabled={busy}>
              Cancel
            </button>
            <button onClick={handleQuickGenerate} className="btn btn-primary" disabled={busy}>
              {busy ? <Spinner /> : <Sparkles className="h-4 w-4" />}
              Publish 2 Daily Tasks (1% Daily)
            </button>
          </div>
        </div>
      </Modal>

      {/* SUBMISSION REVIEW MODAL */}
      <Modal
        open={Boolean(reviewModal)}
        onClose={() => setReviewModal(null)}
        title={reviewModal?.action === 'approve' ? 'Approve Task Submission' : 'Reject Task Submission'}
      >
        {reviewModal && (
          <form onSubmit={handleReviewSubmit} className="space-y-4">
            <div className="rounded-xl border border-white/5 bg-ink-900 p-3 text-xs space-y-1">
              <div className="text-zinc-500">Investor: <strong className="text-white">@{reviewModal.sub.username}</strong></div>
              <div className="text-zinc-500">Task: <strong className="text-white">{reviewModal.sub.task_title}</strong></div>
              <div className="text-zinc-500">Reward: <strong className="font-mono text-amber-400">{usd(reviewModal.sub.reward_amount)}</strong></div>
            </div>

            {reviewModal.sub.proof_text && (
              <div className="rounded-xl border border-white/5 bg-ink-950 p-3">
                <div className="text-[11px] font-semibold text-zinc-400">Investor Note:</div>
                <p className="mt-1 text-xs text-white whitespace-pre-wrap">{reviewModal.sub.proof_text}</p>
              </div>
            )}

            {reviewModal.sub.proof_file && (
              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-ink-900 p-3 text-xs">
                <div className="flex items-center gap-2 text-zinc-300">
                  <FileText className="h-4 w-4 text-sky-400" /> Attached Proof Document
                </div>
                <a
                  href={`/api/admin/tasks/submissions/${reviewModal.sub.id}/proof`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost btn-sm text-sky-400"
                >
                  <Eye className="h-3.5 w-3.5" /> View File
                </a>
              </div>
            )}

            <Field
              label={reviewModal.action === 'approve' ? 'Staff Note (Optional)' : 'Rejection Reason (Required)'}
              hint={reviewModal.action === 'approve' ? 'Leave empty or add a congratulatory note' : 'Investor will see this reason to correct their submission'}
            >
              <textarea
                className="input !h-20"
                required={reviewModal.action === 'reject'}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder={reviewModal.action === 'approve' ? 'Great job!' : 'Please attach a valid screenshot demonstrating completion...'}
              />
            </Field>

            {reviewModal.action === 'approve' && Number(reviewModal.sub.reward_amount) > 0 && (
              <p className="text-xs text-green-400">
                Approving will immediately credit <strong>{usd(reviewModal.sub.reward_amount)}</strong> to the investor's cash balance and create a ledger transaction.
              </p>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
              <button type="button" onClick={() => setReviewModal(null)} className="btn btn-ghost" disabled={busy}>
                Cancel
              </button>
              <button
                type="submit"
                className={reviewModal.action === 'approve' ? 'btn btn-primary' : 'btn btn-warn'}
                disabled={busy}
              >
                {busy ? <Spinner /> : null}
                {reviewModal.action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* PROOF FILE PREVIEW MODAL */}
      <Modal open={Boolean(proofPreview)} onClose={() => setProofPreview(null)} title="Submitted Verification Proof" wide>
        {proofPreview && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <div>Investor: <strong className="text-white">@{proofPreview.username}</strong></div>
              <div>Task: <strong className="text-white">{proofPreview.task_title}</strong></div>
            </div>
            {proofPreview.proof_text && (
              <div className="rounded-xl border border-white/5 bg-ink-900 p-3 text-xs text-zinc-300">
                <strong>Submission Note:</strong> {proofPreview.proof_text}
              </div>
            )}
            <div className="max-h-[60vh] overflow-auto rounded-xl border border-white/5 bg-black/40 p-2 flex justify-center">
              <img
                src={`/api/admin/tasks/submissions/${proofPreview.id}/proof`}
                alt="Verification Proof"
                className="max-h-[55vh] rounded object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentNode.innerHTML = `<div class="p-8 text-center text-sm text-zinc-400">File is a PDF or binary document. <a href="/api/admin/tasks/submissions/${proofPreview.id}/proof" target="_blank" class="text-sky-400 underline ml-2">Click to open/download</a></div>`;
                }}
              />
            </div>
            <div className="flex justify-end">
              <a
                href={`/api/admin/tasks/submissions/${proofPreview.id}/proof`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline btn-sm"
              >
                Open in New Tab
              </a>
            </div>
          </div>
        )}
      </Modal>

      {/* DISPATCH TO USERS MODAL */}
      <Modal
        open={Boolean(dispatchModal)}
        onClose={() => setDispatchModal(null)}
        title={dispatchModal ? `Send Task "${dispatchModal.task_code}" to Users` : 'Dispatch Task'}
      >
        {dispatchModal && (
          <form onSubmit={handleDispatch} className="space-y-4">
            <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4 space-y-2">
              <div className="text-sm font-bold text-white">{dispatchModal.title}</div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded bg-cyan-500/20 px-2 py-0.5 font-mono font-bold text-cyan-300">
                  {dispatchModal.task_code}
                </span>
                <span className="text-zinc-400">· {dispatchModal.trade_duration_seconds || 30}s Trade Time</span>
                <span className="text-zinc-400">· {(dispatchModal.expire_minutes || 180) >= 60 ? `${Math.round((dispatchModal.expire_minutes || 180) / 60 * 10) / 10}h` : `${dispatchModal.expire_minutes || 180}m`} Expiration Window</span>
                <span className="text-emerald-400 font-semibold">· 1.00% Daily Profit (50/50 Split)</span>
              </div>
            </div>

            <Field label="Target Audience" hint="Select which users receive the task code in chat & notification">
              <select
                className="input font-semibold"
                value={dispatchTarget}
                onChange={(e) => setDispatchTarget(e.target.value)}
              >
                <option value="all">🌐 All Registered Investors (Sab ko)</option>
                <option value="package_1">🥉 Package 1 Users ($250 Starter)</option>
                <option value="package_2">🥈 Package 2 Users ($500 Growth)</option>
                <option value="package_3">🥇 Package 3 Users ($1000 Elite)</option>
                <option value="any_package">💎 Any Active Package Investor</option>
              </select>
            </Field>

            <div className="rounded-xl border border-white/5 bg-ink-950 p-3 text-xs text-zinc-400 space-y-1">
              <p className="font-semibold text-zinc-300">⚡ Dispatch Delivery Actions:</p>
              <p>1. Targeted investors receive a direct staff message in their <strong>Support / Chat</strong> with the unique task code and copy button.</p>
              <p>2. A real-time notification with a direct activation link (`/tasks?code=...`) is generated.</p>
              <p>3. Once activated and run (30s), 0.50% profit is credited directly to the user's cash balance (2 tasks = 1.00% daily profit on package).</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setDispatchModal(null)} className="btn btn-ghost" disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? <Spinner /> : <Send className="h-4 w-4" />} Dispatch Code to Users
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
