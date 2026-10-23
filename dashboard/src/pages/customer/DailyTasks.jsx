import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Calendar,
  Check,
  CheckCircle,
  CheckCircle2,
  CheckSquare,
  Clock,
  Coins,
  Copy,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  Flame,
  Gift,
  HelpCircle,
  History,
  Layers,
  Play,
  KeyRound,
  MessageSquare,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Timer,
  TrendingUp,
  Upload,
  Zap,
} from 'lucide-react';
import { useApi, useAuth, useToast } from '../../context/AppContext';
import { api, dateTime, timeAgo, upload, usd } from '../../lib/api';
import { Badge, Card, Empty, ErrorBox, Field, Loading, Modal, Spinner, StatCard, StatusBadge, Tabs } from '../../components/ui';

export default function DailyTasks() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const [tab, setTab] = useState('today');
  const todayStr = new Date().toISOString().slice(0, 10);

  const { data, loading, error, reload } = useApi(`/tasks?date=${todayStr}`);
  const { data: histData, loading: histLoading, reload: reloadHist } = useApi(tab === 'history' ? '/tasks/history' : null);

  // Live timer for task expiration countdown tickers
  const [currentTime, setCurrentTime] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Manual proof submission modal state
  const [submitModal, setSubmitModal] = useState(null); // task object
  const [proofText, setProofText] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [busy, setBusy] = useState(false);

  // Quick activate by task code (received in chat or notification)
  const [codeToActivate, setCodeToActivate] = useState('');
  const [activatingCode, setActivatingCode] = useState(false);

  // Auto-fill and switch tab if code is passed in URL
  useEffect(() => {
    const c = searchParams.get('code');
    if (c) {
      setCodeToActivate(c.trim().toUpperCase());
      setTab('today');
    }
  }, [searchParams]);

  // 30-Second Live Trading Execution Modal state
  const [tradeModal, setTradeModal] = useState(null);
  const [tradeRemaining, setTradeRemaining] = useState(30);
  const [tradeActive, setTradeActive] = useState(false);
  const [tradeDone, setTradeDone] = useState(false);
  const [tradeError, setTradeError] = useState(null);
  const [tradeResult, setTradeResult] = useState(null);
  const [tradeLogs, setTradeLogs] = useState([]);

  // Open manual proof submit modal
  const openSubmit = (task) => {
    setProofText(task.proof_text || '');
    setProofFile(null);
    setSubmitModal(task);
  };

  // Start 30s Live Trade execution session
  const startTradeSession = (task) => {
    const duration = task.trade_duration_seconds || 30;
    const taskReward = Number(task.calculated_reward || 1.25);
    const grossTrade = Number(task.gross_trade_yield || (taskReward * 2));
    const companyProfit = Number(task.company_profit || (grossTrade - taskReward));
    const calculationBalance = Number(data?.user_investment?.cash_balance > 0 ? data?.user_investment?.cash_balance : data?.user_investment?.total_invested ?? 0);
    setTradeModal(task);
    setTradeRemaining(duration);
    setTradeActive(true);
    setTradeDone(false);
    setTradeError(null);
    setTradeResult(null);
    setTradeLogs([
      `[00:00] Initializing automated trade session for ${task.task_code || 'TSK-' + task.id}...`,
      `[00:01] Wallet Cash Balance: ${usd(calculationBalance)} · 1.00% Trade: ${usd(grossTrade)}`,
      `[00:02] Profit Split (50/50): +${usd(taskReward)} to Your Cash Balance · ${usd(companyProfit)} to Company Pool`,
    ]);
  };

  // Activate task by code received in chat
  const handleActivateByCode = async (e) => {
    e?.preventDefault?.();
    if (!codeToActivate.trim()) return;
    setActivatingCode(true);
    try {
      const res = await api('/tasks/activate-by-code', {
        method: 'POST',
        body: { task_code: codeToActivate.trim() },
      });
      if (res?.task) {
        toast.success(`Task ${res.task.task_code || codeToActivate} activated! Starting 30-second live trade session.`);
        startTradeSession(res.task);
        setCodeToActivate('');
      }
    } catch (err) {
      toast.error(err);
    } finally {
      setActivatingCode(false);
    }
  };

  // Automated 30s countdown effect
  useEffect(() => {
    let timer = null;
    if (tradeModal && tradeActive && tradeRemaining > 0) {
      timer = setInterval(() => {
        setTradeRemaining((prev) => {
          const next = prev - 1;
          const totalDur = tradeModal.trade_duration_seconds || 30;
          const elapsed = totalDur - next;

          if (elapsed === 3) {
            setTradeLogs((l) => [...l, `[00:03] Connected to liquidity node. Verifying unique code ${tradeModal.task_code}...`]);
          } else if (elapsed === 9) {
            setTradeLogs((l) => [...l, `[00:09] Executing 1.00% gross trade order book spread across liquidity pools.`]);
          } else if (elapsed === 17) {
            setTradeLogs((l) => [...l, `[00:17] Matched automated trade yield. Calculating 50/50 net profit distribution...`]);
          } else if (elapsed === 25) {
            setTradeLogs((l) => [...l, `[00:25] Cryptographic trade proof generated. Securing yield settlement...`]);
          }

          if (next <= 0) {
            clearInterval(timer);
            completeTrade(tradeModal);
            return 0;
          }
          return next;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [tradeModal, tradeActive, tradeRemaining]);

  // Complete trade API call
  const completeTrade = async (task) => {
    setTradeActive(false);
    setBusy(true);
    try {
      const res = await api(`/tasks/${task.id}/execute-trade`, { method: 'POST' });
      setTradeResult(res);
      setTradeDone(true);
      const totalDur = task.trade_duration_seconds || 30;
      const profitPaid = res.user_profit || res.reward_paid || task.calculated_reward;
      const grossYield = res.gross_trade_yield || (Number(profitPaid) * 2);
      const compProfit = res.company_profit || (grossYield - Number(profitPaid));
      setTradeLogs((l) => [
        ...l,
        `[00:${String(totalDur).padStart(2, '0')}] Settlement complete! 1.00% gross trade: ${usd(grossYield)} (Your 50% share: +${usd(profitPaid)} credited to your cash balance · Company pool: ${usd(compProfit)})`,
      ]);
      toast.success(`Trade completed! +${usd(profitPaid)} credited to your cash balance.`);
      reload();
      if (refresh) refresh();
    } catch (err) {
      setTradeError(err.message || 'Trade execution failed. Please try again.');
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  // Handle manual task submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!submitModal) return;
    setBusy(true);
    try {
      await upload(`/tasks/${submitModal.id}/submit`, {
        proof_text: proofText,
        proof: proofFile,
      });
      toast.success(`Task "${submitModal.title}" submitted for staff review!`);
      setSubmitModal(null);
      setProofText('');
      setProofFile(null);
      reload();
      if (refresh) refresh();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const tasks = data?.tasks || [];
  const userInvestment = data?.user_investment || {
    total_invested: 0,
    cash_balance: 0,
    total_balance: 0,
    daily_yield_pct: 1.0,
    per_task_yield_pct: 0.5,
    has_active_package: false,
  };
  const summary = data?.summary || {
    total_today: 0,
    completed_today: 0,
    pending_today: 0,
    rewards_today: 0,
    rewards_all_time: 0,
  };

  const percent = summary.total_today > 0 ? Math.round((summary.completed_today / summary.total_today) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Gamified Hero Banner with Daily Yield Callout */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card relative overflow-hidden p-6 border-green-500/20 bg-gradient-to-br from-ink-900 via-ink-850 to-ink-900"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-green-500/10 blur-3xl" />
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-6 items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-0.5 text-[11px] font-bold text-green-400">
                <Sparkles className="h-3 w-3" /> DAILY TRADE TASKS
              </span>
              <span className="flex h-6 items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-bold text-cyan-300">
                <Timer className="h-3 w-3" /> 30s EXECUTION · 1.00% DAILY YIELD
              </span>
              <span className="text-xs text-zinc-400">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Execute Daily Trade Tasks & Earn Daily Profit
            </h1>
            <p className="max-w-2xl text-sm text-zinc-300 leading-relaxed">
              Complete your 2 daily high-frequency trade tasks (30s each) to earn an exact <strong className="text-green-400">1.00% daily profit</strong> (0.50% per task) on your total account net worth, credited directly to your cash balance!
            </p>
          </div>

          {/* Daily Progress Gauge & Package Return Rate */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-2xl border border-white/5 bg-ink-950/70 p-4">
            <div className="flex items-center gap-3">
              <div className="relative grid h-14 w-14 place-items-center">
                <svg className="h-14 w-14 -rotate-90 transform" viewBox="0 0 36 36">
                  <path
                    className="text-white/10"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-green-400 transition-all duration-700 ease-out"
                    strokeDasharray={`${percent}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="absolute font-mono text-xs font-bold text-white">{percent}%</span>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Today's Progress</div>
                <div className="text-sm font-bold text-white">
                  {summary.completed_today} of {summary.total_today} Tasks Done
                </div>
              </div>
            </div>

            <div className="h-10 w-px bg-white/10 hidden sm:block" />

            <div className="space-y-0.5">
              <div className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Today's Profit Earned</div>
              <div className="font-mono text-lg font-bold text-emerald-400">+{usd(summary.rewards_today)}</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Account Investment & Daily Yield Callout Banner */}
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 grid place-items-center shrink-0 text-emerald-400">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                Wallet Cash Balance
              </span>
              <Badge tone={userInvestment.has_active_package ? 'green' : 'amber'}>
                {userInvestment.has_active_package ? 'Active Investor' : 'No Package Activated'}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-bold font-mono text-white">
                {usd((userInvestment.cash_balance > 0 ? userInvestment.cash_balance : userInvestment.total_invested) || 0)}
              </span>
              <span className="text-xs text-zinc-400">
                · Daily Yield Rate: <strong className="text-emerald-400">1.00% Net Daily</strong> (2 Tasks × 1.00% Trade with 50/50 Split = {usd(((userInvestment.cash_balance > 0 ? userInvestment.cash_balance : userInvestment.total_invested) || 0) * 0.01)}/day)
              </span>
            </div>
          </div>
        </div>

        {!userInvestment.has_active_package ? (
          <Link to="/packages" className="btn btn-primary btn-sm shrink-0">
            <Zap className="h-3.5 w-3.5" /> Activate Investment Package →
          </Link>
        ) : (
          <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>2 tasks execute a 1.00% gross trade each with a 50/50 split (1.00% net daily profit to your cash balance)</span>
          </div>
        )}
      </div>

      {/* Activate by Task Code Bar (from Chat / Notification) */}
      <div className="rounded-2xl border border-cyan-500/25 bg-gradient-to-r from-cyan-500/10 via-ink-900 to-ink-900 p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
              <MessageSquare className="h-4 w-4" /> Received a Task Code in Chat?
            </div>
            <p className="text-xs text-zinc-300">
              Staff / Agents send unique codes to your <Link to="/support" className="text-cyan-400 underline font-semibold hover:text-cyan-300">Support Chat</Link>. Enter your code below to instantly activate and launch the 30-second trade.
              {!userInvestment.has_active_package && (
                <span className="block mt-1 text-amber-300 font-medium">
                  ⚠️ Note: Daily trade tasks require an activated investment package ($250, $500, or $1,000).
                </span>
              )}
            </p>
          </div>
          <form onSubmit={handleActivateByCode} className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <KeyRound className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                className="input pl-9 font-mono uppercase text-sm tracking-wider"
                placeholder="TSK-XXXXXX"
                value={codeToActivate}
                onChange={(e) => setCodeToActivate(e.target.value.toUpperCase())}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary whitespace-nowrap shrink-0"
              disabled={activatingCode || !codeToActivate.trim()}
            >
              {activatingCode ? <Spinner className="!text-ink-950" /> : <Play className="h-4 w-4" />}
              Activate & Trade
            </button>
          </form>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          index={0}
          label="Today's Tasks"
          value={summary.total_today}
          valueClass="text-green-400"
          icon={Calendar}
          tone="green"
          hint={`${summary.completed_today} completed · ${summary.pending_today} pending`}
        />
        <StatCard
          index={1}
          label="Estimated Daily Profit"
          value={usd((((userInvestment.cash_balance > 0 ? userInvestment.cash_balance : userInvestment.total_invested) || 0) * 0.01))}
          valueClass="text-emerald-400"
          icon={TrendingUp}
          tone="green"
          hint={userInvestment.has_active_package ? "1.00% on wallet balance" : "Activate package to earn"}
        />
        <StatCard
          index={2}
          label="Total Task Profit Earned"
          value={usd(summary.rewards_all_time)}
          valueClass="text-amber-400"
          icon={Coins}
          tone="amber"
          hint="Credited to your Cash Balance"
        />
        <StatCard
          index={3}
          label="Available Cash Balance"
          value={usd(user?.cash_balance || 0)}
          valueClass="text-white"
          icon={Coins}
          tone="blue"
          hint={<Link to="/packages" className="text-sky-400 hover:underline">Activate a Package →</Link>}
        />
      </div>

      {/* Tabs and Content */}
      <Card
        title={tab === 'today' ? "Today's Active Tasks" : 'Your Task History'}
        subtitle={
          tab === 'today'
            ? 'Execute your 30-second trade tasks today to earn 0.50% profit per task (1.00% daily total).'
            : 'Record of all past daily trade tasks and completed executions.'
        }
        icon={tab === 'today' ? CheckSquare : History}
        actions={
          <Tabs
            tabs={[
              ['today', `Today's Tasks (${tasks.length})`],
              ['history', 'Task History'],
            ]}
            value={tab}
            onChange={setTab}
          />
        }
      >
        {/* TODAY'S TASKS TAB */}
        {tab === 'today' && (
          <div>
            {loading && !data ? (
              <Loading />
            ) : error ? (
              <ErrorBox error={error} onRetry={reload} />
            ) : !userInvestment.has_active_package ? (
              <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 via-ink-950/80 to-ink-950 p-8 sm:p-10 text-center">
                <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl border border-amber-500/30 bg-amber-500/15 text-amber-400 shadow-lg shadow-amber-500/10">
                  <AlertCircle className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold text-white sm:text-2xl">
                  Investment Package Activation Required
                </h3>
                <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-300 leading-relaxed">
                  Daily trade tasks are exclusively assigned to accounts with an active investment package.
                  Activate any of our 3 curated packages (<strong className="text-amber-300">$250 Starter</strong>, <strong className="text-amber-300">$500 Standard</strong>, or <strong className="text-amber-300">$1,000 Elite</strong>) to immediately unlock and receive your 2 daily high-frequency trade tasks to earn an exact <strong className="text-green-400">1.00% daily yield</strong>!
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <Link to="/packages" className="btn btn-primary">
                    <Zap className="h-4 w-4" /> View Investment Packages ($250, $500, $1,000)
                  </Link>
                  <Link to="/deposit" className="btn btn-secondary">
                    <Coins className="h-4 w-4" /> Deposit Funds First
                  </Link>
                </div>
              </div>
            ) : tasks.length === 0 ? (
              <Empty
                title="No trade tasks scheduled for today"
                text="The trading desk will issue new daily trade tasks shortly. Please check back later!"
              />
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {tasks.map((task, idx) => {
                  const status = task.submission_status; // null, 'pending', 'approved', 'rejected'
                  const isDone = status === 'approved';
                  const isPending = status === 'pending';
                  const isRejected = status === 'rejected';

                  // Calculate expiration live
                  const expMs = task.expires_at ? new Date(task.expires_at).getTime() - currentTime : null;
                  const isExpired = expMs !== null ? expMs <= 0 : false;
                  const formattedRemaining =
                    expMs !== null && expMs > 0
                      ? expMs >= 3600000
                        ? `${Math.floor(expMs / 3600000)}h ${Math.floor((expMs % 3600000) / 60000)}m ${Math.floor((expMs % 60000) / 1000)}s`
                        : `${Math.floor(expMs / 60000)}m ${Math.floor((expMs % 60000) / 1000)}s`
                      : task.expires_at
                      ? 'Expired'
                      : null;

                  return (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className={`relative flex flex-col justify-between rounded-2xl border p-5 transition ${
                        isDone
                          ? 'border-green-500/30 bg-green-500/[0.04]'
                          : isPending
                          ? 'border-amber-500/30 bg-amber-500/[0.03]'
                          : isRejected
                          ? 'border-rose-500/30 bg-rose-500/[0.03]'
                          : isExpired
                          ? 'border-zinc-800 bg-ink-950/40 opacity-75'
                          : 'border-white/10 bg-ink-900/60 hover:border-emerald-500/30 shadow-lg'
                      }`}
                    >
                      <div>
                        {/* Header badge row */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded-lg border border-green-500/30 bg-green-500/10 px-2.5 py-1 font-mono text-xs font-bold text-green-400">
                              Task #{task.task_slot}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const code = task.task_code || `TSK-${task.id}`;
                                navigator.clipboard.writeText(code);
                                toast.success(`Copied task code: ${code}`);
                              }}
                              className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-xs font-bold text-cyan-300 inline-flex items-center gap-1 hover:bg-cyan-500/20 transition cursor-pointer"
                              title="Click to copy task code"
                            >
                              <span>{task.task_code || `TSK-${task.id}`}</span>
                              <Copy className="h-3 w-3 opacity-70" />
                            </button>
                            {isDone ? (
                              <Badge tone="green" className="!px-2 !py-0.5">
                                <Check className="h-3 w-3" /> Profit Paid
                              </Badge>
                            ) : isPending ? (
                              <Badge tone="amber" className="!px-2 !py-0.5">
                                <Clock className="h-3 w-3" /> Under Review
                              </Badge>
                            ) : isExpired ? (
                              <Badge tone="rose" className="!px-2 !py-0.5">
                                Expired
                              </Badge>
                            ) : (
                              <Badge tone="green" className="!px-2 !py-0.5">
                                Live & Ready
                              </Badge>
                            )}
                          </div>

                          <div className="text-right">
                            <div className="flex items-center gap-1 font-mono text-sm font-bold text-emerald-400">
                              <Coins className="h-3.5 w-3.5 text-emerald-400" />
                              +{usd(task.calculated_reward || task.reward_amount)}
                            </div>
                            <div className="text-[10px] text-zinc-400 font-medium">50% of 1.00% Trade</div>
                          </div>
                        </div>

                        {/* Title & Description */}
                        <h3 className="mt-3 text-lg font-bold text-white">{task.title}</h3>
                        {task.description && (
                          <p className="mt-1.5 text-xs text-zinc-300 leading-relaxed">{task.description}</p>
                        )}

                        {/* Trade Time & Expiration Badges */}
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                          <span className="flex items-center gap-1 rounded-md bg-white/5 border border-white/10 px-2 py-0.5 text-zinc-300">
                            <Timer className="h-3 w-3 text-amber-400" />
                            <strong>{task.trade_duration_seconds || 30}s</strong> Live Trade Execution
                          </span>
                          {formattedRemaining && (
                            <span
                              className={`flex items-center gap-1 rounded-md px-2 py-0.5 border ${
                                isExpired
                                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                                  : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                              }`}
                            >
                              <Clock className="h-3 w-3" />
                              {isExpired ? 'Trade Window Expired' : `Expires in: ${formattedRemaining}`}
                            </span>
                          )}
                        </div>

                        {/* Instructions */}
                        {task.instructions && (
                          <div className="mt-3 rounded-xl border border-white/5 bg-ink-950/60 p-3 text-xs">
                            <div className="font-semibold text-zinc-400 uppercase tracking-wider text-[10px]">
                              Instructions:
                            </div>
                            <p className="mt-1 text-zinc-300 leading-relaxed">{task.instructions}</p>
                          </div>
                        )}

                        {/* Submission status feedback */}
                        {isDone && (
                          <div className="mt-4 flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-xs text-green-300">
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
                            <div>
                              <span className="font-semibold">Profit Credited!</span> You earned {usd(task.reward_paid || task.calculated_reward)} (0.50% yield) for completing this trade session.
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Footer Actions */}
                      <div className="mt-5 border-t border-white/5 pt-4 space-y-2">
                        {isDone ? (
                          <div className="flex items-center justify-between text-xs text-zinc-500">
                            <span>Completed successfully</span>
                            <span className="font-mono text-green-400 font-semibold">{usd(task.reward_paid || task.calculated_reward)} credited</span>
                          </div>
                        ) : isPending ? (
                          <button
                            onClick={() => openSubmit(task)}
                            className="btn btn-outline btn-sm w-full border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Update Submission Note / Proof
                          </button>
                        ) : isExpired ? (
                          <button disabled className="btn btn-ghost btn-sm w-full opacity-50 cursor-not-allowed">
                            ⚠️ Trade Session Expired
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => startTradeSession(task)}
                              className="btn btn-primary btn-sm w-full bg-gradient-to-r from-emerald-600 via-green-500 to-emerald-600 hover:from-emerald-500 hover:to-green-400 text-white font-bold shadow-lg shadow-emerald-500/20"
                            >
                              <Zap className="h-4 w-4 text-amber-300 fill-amber-300" /> Execute {task.trade_duration_seconds || 30}s Live Trade (+{usd(task.calculated_reward)})
                            </button>
                            {task.requires_proof && (
                              <button
                                onClick={() => openSubmit(task)}
                                className="text-[11px] text-zinc-400 hover:text-white underline w-full text-center block pt-1"
                              >
                                Or submit manual proof note
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TASK HISTORY TAB */}
        {tab === 'history' && (
          <div>
            {histLoading && !histData ? (
              <Loading />
            ) : !histData?.submissions?.length ? (
              <Empty
                title="No task history yet"
                text="Complete daily tasks from the 'Today's Tasks' tab to start building your rewards record."
              />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Task ID & Title</th>
                      <th>Reward Profit</th>
                      <th>Execution Details</th>
                      <th>Status</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {histData.submissions.map((s) => (
                      <tr key={s.id}>
                        <td className="font-mono text-xs text-zinc-400">{s.task_date}</td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            {s.task_code && (
                              <span className="font-mono text-[11px] font-bold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
                                {s.task_code}
                              </span>
                            )}
                            <div className="font-semibold text-white">{s.task_title}</div>
                          </div>
                        </td>
                        <td className="font-mono font-bold text-emerald-400">
                          {s.status === 'approved' ? `+${usd(s.reward_paid)}` : usd(s.reward_amount)}
                        </td>
                        <td>
                          <div className="max-w-xs space-y-0.5">
                            {s.proof_text ? (
                              <p className="line-clamp-1 text-xs text-zinc-300">{s.proof_text}</p>
                            ) : (
                              <span className="text-xs text-zinc-500 italic">30s automated trade execution</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <StatusBadge status={s.status} />
                          {s.admin_note && (
                            <div className="mt-0.5 text-[10px] text-zinc-400">Note: {s.admin_note}</div>
                          )}
                        </td>
                        <td className="text-xs text-zinc-400" title={dateTime(s.updated_at)}>
                          {timeAgo(s.updated_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 30-SECOND LIVE TRADING EXECUTION MODAL */}
      <Modal
        open={Boolean(tradeModal)}
        onClose={() => {
          if (tradeActive && !tradeDone) {
            if (!window.confirm('A live 30-second trade execution is currently in progress. Cancel?')) return;
          }
          setTradeModal(null);
          setTradeActive(false);
        }}
        title={`Live Trade Execution Desk · ${tradeModal?.task_code || 'TSK-LIVE'}`}
        wide
      >
        {tradeModal && (
          <div className="space-y-5">
            {/* Top stats bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl border border-white/5 bg-ink-950 p-3 text-xs">
              <div>
                <div className="text-zinc-500 uppercase font-semibold text-[10px]">Unique Task ID</div>
                <div className="font-mono font-bold text-cyan-300">{tradeModal.task_code || `TSK-${tradeModal.id}`}</div>
              </div>
              <div>
                <div className="text-zinc-500 uppercase font-semibold text-[10px]">Account Investment</div>
                <div className="font-mono font-bold text-white">{usd(userInvestment.total_invested)}</div>
              </div>
              <div>
                <div className="text-zinc-500 uppercase font-semibold text-[10px]">Profit Yield Rate</div>
                <div className="font-mono font-bold text-emerald-400">0.50% Yield</div>
              </div>
              <div>
                <div className="text-zinc-500 uppercase font-semibold text-[10px]">Expected Profit</div>
                <div className="font-mono font-bold text-amber-400">+{usd(tradeModal.calculated_reward)}</div>
              </div>
            </div>

            {/* Simulated Live Trading Oscilloscope / Candlestick Animation */}
            <div className="relative rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-ink-950 via-ink-900 to-ink-950 p-6 overflow-hidden">
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-500/10 blur-2xl" />

              <div className="flex flex-col items-center justify-center text-center space-y-4">
                {/* Timer Clock Circle */}
                <div className="relative grid place-items-center h-28 w-28">
                  <svg className="h-28 w-28 -rotate-90 transform" viewBox="0 0 36 36">
                    <path
                      className="text-white/10"
                      strokeWidth="3"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-emerald-400 transition-all duration-1000 ease-linear"
                      strokeDasharray={`${
                        Math.round((((tradeModal.trade_duration_seconds || 30) - tradeRemaining) / (tradeModal.trade_duration_seconds || 30)) * 100)
                      }, 100`}
                      strokeWidth="3"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="font-mono text-2xl font-bold text-white">
                      00:{String(tradeRemaining).padStart(2, '0')}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-emerald-400">
                      {tradeDone ? 'SETTLED' : 'TRADING'}
                    </span>
                  </div>
                </div>

                {/* Animated progress bar */}
                <div className="w-full max-w-md space-y-1.5">
                  <div className="flex justify-between text-xs text-zinc-400 font-mono">
                    <span>HFT Arbitrage Routing</span>
                    <span>
                      {Math.round(
                        (((tradeModal.trade_duration_seconds || 30) - tradeRemaining) / (tradeModal.trade_duration_seconds || 30)) * 100,
                      )}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-emerald-500 via-green-400 to-cyan-400"
                      initial={{ width: 0 }}
                      animate={{
                        width: `${Math.round(
                          (((tradeModal.trade_duration_seconds || 30) - tradeRemaining) / (tradeModal.trade_duration_seconds || 30)) * 100,
                        )}%`,
                      }}
                      transition={{ ease: 'linear', duration: 0.9 }}
                    />
                  </div>
                </div>

                {/* Status headline */}
                {tradeDone ? (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-center space-y-3 w-full max-w-md"
                  >
                    <div className="flex items-center justify-center gap-2 text-green-400 font-bold text-base">
                      <CheckCircle2 className="h-5 w-5" /> 30-Second Trade Executed Successfully!
                    </div>

                    {/* Package Profit Breakdown Card */}
                    <div className="rounded-xl bg-ink-950/90 border border-white/10 p-3.5 space-y-2.5 text-xs text-left">
                      <div className="flex justify-between items-center text-zinc-400">
                        <span>Wallet Cash Balance:</span>
                        <span className="font-mono font-bold text-white text-sm">
                          {usd(tradeResult?.base_amount || (tradeResult?.cash_balance > 0 ? tradeResult?.cash_balance : tradeResult?.total_invested) || (data?.user_investment?.cash_balance > 0 ? data?.user_investment?.cash_balance : data?.user_investment?.total_invested) || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-zinc-400">
                        <span>1.00% Gross Trade Yield:</span>
                        <span className="font-mono font-medium text-white">
                          {usd(tradeResult?.gross_trade_yield || (Number(tradeResult?.user_profit || tradeModal.calculated_reward) * 2))}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-zinc-400">
                        <span>Profit Split (50% User / 50% Company):</span>
                        <span className="font-mono font-medium text-emerald-300">
                          +{usd(tradeResult?.user_profit || tradeModal.calculated_reward)} / {usd(tradeResult?.company_profit || tradeModal.calculated_reward)}
                        </span>
                      </div>
                      <div className="h-px bg-white/10" />
                      <div className="flex justify-between items-center text-emerald-400 font-semibold">
                        <span className="flex items-center gap-1.5">
                          <Check className="h-3.5 w-3.5" /> Profit Credited to Wallet:
                        </span>
                        <span className="font-mono font-bold text-base">
                          +{usd(tradeResult?.user_profit || tradeResult?.reward_paid || tradeModal.calculated_reward)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-zinc-400">
                        <span className="flex items-center gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Daily Target Status:
                        </span>
                        <span className="font-mono font-medium text-zinc-300">
                          {data?.summary?.completed_today >= 1 ? '1.00% Daily Profit Completed! 🎉 (2 of 2 Tasks Done)' : 'Task 1 of 2 Complete (0.50% net credited)'}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-green-300">
                      ✓ Profit has been credited directly to your cash balance!
                    </p>
                  </motion.div>
                ) : tradeError ? (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-rose-300 text-xs w-full max-w-md">
                    ⚠️ {tradeError}
                  </div>
                ) : (
                  <div className="space-y-2 w-full max-w-md text-center">
                    <div className="flex items-center justify-center gap-2 text-xs font-semibold text-zinc-300">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      <span>Executing 1.00% gross trade with 50/50 profit split...</span>
                    </div>
                    <div className="flex justify-center items-center gap-2 text-[11px] text-zinc-400 font-mono">
                      <span>Your 50% Profit Share: <strong className="text-emerald-400 font-semibold">+{usd(tradeModal.calculated_reward)}</strong></span>
                      <span>·</span>
                      <span>Daily Net Target: <strong className="text-zinc-300 font-semibold">{usd(Number(tradeModal.calculated_reward) * 2)} (1.00%)</strong></span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Real-time execution logs terminal */}
            <div className="rounded-xl border border-white/5 bg-ink-950 p-3 space-y-1.5 font-mono text-xs">
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5 text-cyan-400" /> Execution Terminal Log
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto pr-1 text-zinc-400">
                {tradeLogs.map((log, i) => (
                  <div key={i} className="text-[11px] leading-tight text-emerald-300/90">
                    {log}
                  </div>
                ))}
              </div>
            </div>

            {/* Modal actions */}
            <div className="flex justify-end gap-3 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => {
                  setTradeModal(null);
                  setTradeActive(false);
                }}
                className="btn btn-primary"
              >
                {tradeDone ? 'Done & Return to Tasks' : 'Close'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* SUBMIT MANUAL PROOF MODAL (FALLBACK) */}
      <Modal
        open={Boolean(submitModal)}
        onClose={() => setSubmitModal(null)}
        title={submitModal ? `Submit Task Proof: ${submitModal.title}` : ''}
      >
        {submitModal && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-xl border border-white/5 bg-ink-900 p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">Task #{submitModal.task_slot} ({submitModal.task_code || 'TSK'})</span>
                <span className="font-mono text-emerald-400 font-bold">Reward: +{usd(submitModal.calculated_reward)}</span>
              </div>
              {submitModal.instructions && (
                <p className="text-zinc-400 pt-1 border-t border-white/5">{submitModal.instructions}</p>
              )}
            </div>

            <Field
              label="Submission Details / Proof Note"
              hint={submitModal.requires_proof ? 'Required: note your completion details or feedback' : 'Optional confirmation note'}
            >
              <textarea
                className="input !h-24"
                required={submitModal.requires_proof && !proofFile}
                value={proofText}
                onChange={(e) => setProofText(e.target.value)}
                placeholder="e.g. Verified today's NAV performance and completed market review..."
              />
            </Field>

            <Field
              label="Upload Screenshot or Verification File (Optional)"
              hint="Attach an image or PDF (PNG, JPG, WEBP, PDF up to 8 MB) as proof"
            >
              <div className="mt-1 flex items-center gap-3">
                <label className="btn btn-outline btn-sm cursor-pointer">
                  <Upload className="h-4 w-4" /> Choose File
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,application/pdf"
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                  />
                </label>
                <span className="truncate text-xs text-zinc-400">
                  {proofFile ? proofFile.name : 'No file chosen'}
                </span>
              </div>
            </Field>

            <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
              <button type="button" onClick={() => setSubmitModal(null)} className="btn btn-ghost" disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? <Spinner /> : <Check className="h-4 w-4" />}
                Submit Task for Review
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
