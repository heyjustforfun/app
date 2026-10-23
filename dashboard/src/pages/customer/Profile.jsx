import { useEffect, useState } from 'react';
import { BadgeCheck, KeyRound, ShieldCheck, Upload, UserCircle } from 'lucide-react';
import { useAuth, useToast } from '../../context/AppContext';
import { api, date, upload } from '../../lib/api';
import { Card, Field, Spinner, StatusBadge } from '../../components/ui';

export default function Profile({ admin = false }) {
  const { user, setUser, refresh } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState({ full_name: user.full_name || '', phone: user.phone || '' });
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [kyc, setKyc] = useState({ national_id: '', document: null });
  const [busy, setBusy] = useState('');

  // Pick up KYC decisions made by staff since sign-in
  useEffect(() => {
    refresh();
  }, [refresh]);

  const run = (key, fn) => async (e) => {
    e.preventDefault();
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy('');
    }
  };

  const saveProfile = run('profile', async () => {
    const { user: u } = await api('/me/profile', { method: 'PUT', body: profile });
    setUser(u);
    toast.success('Profile updated');
  });

  const savePassword = run('password', async () => {
    if (pw.new_password !== pw.confirm) throw new Error('New passwords do not match');
    await api('/me/password', { method: 'PUT', body: pw });
    setPw({ current_password: '', new_password: '', confirm: '' });
    toast.success('Password changed. Other devices have been signed out.');
  });

  const submitKyc = run('kyc', async () => {
    const { user: u } = await upload('/me/kyc', kyc);
    setUser(u);
    toast.success('Documents submitted for review');
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Profile" subtitle={`Member since ${date(user.created_at)}`} icon={UserCircle}>
        <form onSubmit={saveProfile} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Username">
              <input className="input" value={user.username} disabled />
            </Field>
            <Field label="Email">
              <input className="input" value={user.email} disabled />
            </Field>
          </div>
          <Field label="Full legal name">
            <input className="input" required value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input className="input" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
          </Field>
          <button className="btn btn-primary" disabled={busy === 'profile'}>
            {busy === 'profile' && <Spinner className="!text-ink-950" />} Save Profile
          </button>
          <p className="text-xs text-zinc-600">To change your email or username, contact support.</p>
        </form>
      </Card>

      <Card title="Password" subtitle="Changing your password signs out all other devices" icon={KeyRound}>
        <form onSubmit={savePassword} className="space-y-4">
          <Field label="Current password">
            <input className="input" type="password" autoComplete="current-password" required value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} />
          </Field>
          <Field label="New password" hint="At least 8 characters">
            <input className="input" type="password" autoComplete="new-password" required minLength={8} value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} />
          </Field>
          <Field label="Confirm new password">
            <input className="input" type="password" autoComplete="new-password" required value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
          </Field>
          <button className="btn btn-primary" disabled={busy === 'password'}>
            {busy === 'password' && <Spinner className="!text-ink-950" />} Change Password
          </button>
        </form>
      </Card>

      {!admin && (
        <Card
          title="Identity Verification (KYC)"
          subtitle="One person, one account. Required before withdrawals."
          icon={ShieldCheck}
          className="lg:col-span-2"
          actions={<StatusBadge status={user.kyc_status} />}
        >
          {user.kyc_status === 'verified' && (
            <div className="flex items-center gap-3 rounded-xl border border-green-500/20 bg-green-500/5 p-4 text-sm text-green-300">
              <BadgeCheck className="h-5 w-5" /> Your identity is verified (ID {user.national_id}). Withdrawals are enabled.
            </div>
          )}
          {user.kyc_status === 'pending' && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200">
              Your documents are being reviewed by our compliance team. We'll notify you as soon as it's done.
            </div>
          )}
          {(user.kyc_status === 'none' || user.kyc_status === 'rejected') && (
            <form onSubmit={submitKyc} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
              {user.kyc_status === 'rejected' && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-sm text-rose-300 md:col-span-3">
                  Your previous submission was not accepted: {user.kyc_note || 'please upload a clearer document'}.
                </div>
              )}
              <Field label="National ID / passport number">
                <input className="input font-mono uppercase" required minLength={4} value={kyc.national_id} onChange={(e) => setKyc({ ...kyc, national_id: e.target.value })} />
              </Field>
              <Field label="Photo or scan of the document">
                <input className="input" type="file" required accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => setKyc({ ...kyc, document: e.target.files[0] || null })} />
              </Field>
              <button className="btn btn-primary" disabled={busy === 'kyc'}>
                {busy === 'kyc' ? <Spinner className="!text-ink-950" /> : <Upload className="h-4 w-4" />} Submit
              </button>
            </form>
          )}
        </Card>
      )}
    </div>
  );
}
