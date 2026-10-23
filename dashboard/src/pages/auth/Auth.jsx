import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, BadgeCheck, Eye, EyeOff, LineChart, Lock, ShieldCheck } from 'lucide-react';
import { useAuth, useToast } from '../../context/AppContext';
import { WEBSITE_URL } from '../../lib/api';
import { Field, Logo, Spinner } from '../../components/ui';
import InstallButton from '../../components/InstallButton';

function AuthLayout({ title, subtitle, children }) {
  const [params] = useSearchParams();
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden border-r border-white/5 bg-ink-950 p-12 lg:flex lg:flex-col">
        <motion.div
          className="pointer-events-none absolute -top-32 -left-32 h-[480px] w-[480px] rounded-full bg-green-500/15 blur-[120px]"
          animate={{ x: [0, 80, 0], y: [0, 60, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        />
        <a href={WEBSITE_URL} className="relative">
          <Logo />
        </a>
        <div className="relative my-auto">
          <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-4xl leading-tight font-bold text-white">
            Your portfolio,
            <br />
            <span className="text-green-400">fully transparent.</span>
          </motion.h2>
          <div className="mt-10 space-y-5">
            {[
              [LineChart, 'Daily NAV pricing', 'See exactly what every unit you own is worth.'],
              [ShieldCheck, 'Verified & audited', 'Every staff action on your account is recorded.'],
              [BadgeCheck, 'One person, one account', 'Identity checks keep the investor register clean.'],
            ].map(([Icon, t, d], i) => (
              <motion.div key={t} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.12 }} className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-green-500/10 text-green-400">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-semibold text-white">{t}</div>
                  <div className="text-sm text-zinc-500">{d}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-zinc-600">Investments can go down as well as up. You may get back less than you invest.</p>
      </div>

      <div className="flex flex-col px-4 py-8 sm:px-8">
        <div className="flex items-center justify-between">
          <a href={WEBSITE_URL} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back to website
          </a>
          {params.get('install') && <InstallButton />}
        </div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="m-auto w-full max-w-md py-10">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </motion.div>
      </div>
    </div>
  );
}

function PasswordInput(props) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={show ? 'text' : 'password'} className="input pr-10" />
      <button type="button" onClick={() => setShow(!show)} className="absolute top-1/2 right-3 -translate-y-1/2 text-zinc-500 hover:text-white" tabIndex={-1}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ login: '', password: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const user = await login(form.login, form.password);
      const isStaff = user.role === 'admin' || user.role === 'agent';
      navigate(isStaff ? '/admin' : location.state?.from || '/', { replace: true });
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your investor portal.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email or username">
          <input className="input" autoComplete="username" required value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} />
        </Field>
        <Field label="Password">
          <PasswordInput autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <button className="btn btn-primary w-full !py-3" disabled={busy}>
          {busy ? <Spinner className="!text-ink-950" /> : <Lock className="h-4 w-4" />} Sign In
        </button>
        <p className="text-center text-xs text-zinc-500">Forgot your password? Contact support and we'll reset it after verifying your identity.</p>
      </form>
      <p className="mt-8 text-center text-sm text-zinc-500">
        New here?{' '}
        <Link to="/register" className="font-semibold text-green-400 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}

export function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    full_name: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    referral_code: params.get('ref') || '',
    accept_terms: false,
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await register(form);
      toast.success('Account created. Welcome!');
      navigate(params.get('fund') ? '/funds' : '/', { replace: true });
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="It takes about two minutes. You'll verify your identity afterwards.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full legal name">
          <input className="input" autoComplete="name" required value={form.full_name} onChange={set('full_name')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Username" hint="Letters, numbers and _ only">
            <input className="input" autoComplete="username" required pattern="[A-Za-z0-9_]{3,30}" value={form.username} onChange={set('username')} />
          </Field>
          <Field label="Phone (optional)">
            <input className="input" autoComplete="tel" value={form.phone} onChange={set('phone')} />
          </Field>
        </div>
        <Field label="Email address">
          <input className="input" type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Password" hint="At least 8 characters">
          <PasswordInput autoComplete="new-password" required minLength={8} value={form.password} onChange={set('password')} />
        </Field>
        <Field label="Referral code (optional)">
          <input className="input uppercase" value={form.referral_code} onChange={set('referral_code')} />
        </Field>
        <label className="flex items-start gap-3 rounded-xl border border-white/5 bg-ink-850 p-3 text-xs text-zinc-400">
          <input type="checkbox" className="mt-0.5 accent-green-500" checked={form.accept_terms} onChange={set('accept_terms')} required />
          <span>
            I agree to the terms of service and confirm I understand that investments can fall as well as rise, returns are not guaranteed, and
            I may get back less than I invest.
          </span>
        </label>
        <button className="btn btn-primary w-full !py-3" disabled={busy}>
          {busy && <Spinner className="!text-ink-950" />} Create Account
        </button>
      </form>
      <p className="mt-8 text-center text-sm text-zinc-500">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-green-400 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
