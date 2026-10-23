import { useEffect, useState } from 'react';
import { Building, Database, Download, Landmark, Settings as SettingsIcon, SlidersHorizontal } from 'lucide-react';
import { useApi, useToast } from '../../context/AppContext';
import { api } from '../../lib/api';
import { Card, ErrorBox, Field, Loading, Spinner } from '../../components/ui';

const GROUPS = [
  [
    'Company & contact',
    Building,
    [
      ['company_name', 'Registered company name'],
      ['support_email', 'Support email'],
      ['support_phone', 'Support phone'],
      ['office_address', 'Office address'],
      ['regulatory_notice', 'Risk warning / regulatory notice (website footer)', 'textarea'],
    ],
  ],
  [
    'Deposit & payment methods',
    Landmark,
    [
      ['binance_id', 'Binance ID / Pay ID'],
      ['bank_name', 'Bank name'],
      ['bank_account_name', 'Account name'],
      ['bank_account_number', 'Account number'],
      ['bank_iban', 'IBAN'],
      ['bank_swift', 'SWIFT / BIC'],
      ['deposit_instructions', 'Instructions shown to investors', 'textarea'],
    ],
  ],
  [
    'Limits & rules',
    SlidersHorizontal,
    [
      ['min_deposit', 'Minimum deposit (USD)', 'number'],
      ['min_withdrawal', 'Minimum withdrawal (USD)', 'number'],
      ['withdrawal_requires_kyc', 'Require verified identity before withdrawals', 'toggle'],
    ],
  ],
];

export default function Settings() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi('/admin/settings');
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [downloadingSql, setDownloadingSql] = useState(false);

  useEffect(() => {
    if (data) setForm(data.settings);
  }, [data]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { settings } = await api('/admin/settings', { method: 'PUT', body: { settings: form } });
      setForm(settings);
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadBackup = async () => {
    setDownloadingSql(true);
    try {
      window.open('/api/admin/export-database', '_blank');
      toast.success('Database SQL export initiated!');
    } catch (err) {
      toast.error('Failed to trigger database export');
    } finally {
      setTimeout(() => setDownloadingSql(false), 2000);
    }
  };

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-2">
          {GROUPS.map(([title, Icon, fields]) => (
            <Card key={title} title={title} icon={Icon} className={title === 'Limits & rules' ? 'xl:col-span-2' : ''}>
              <div className="grid gap-4 sm:grid-cols-2">
                {fields.map(([key, label, type]) =>
                  type === 'toggle' ? (
                    <label key={key} className="flex items-center gap-3 rounded-xl border border-white/5 bg-ink-900 p-3 text-sm sm:col-span-2">
                      <input type="checkbox" className="h-4 w-4 accent-green-500" checked={form[key] === '1'} onChange={(e) => setForm({ ...form, [key]: e.target.checked ? '1' : '0' })} />
                      {label}
                    </label>
                  ) : (
                    <Field key={key} label={label} className={type === 'textarea' ? 'sm:col-span-2' : ''}>
                      {type === 'textarea' ? (
                        <textarea className="input min-h-20" value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                      ) : (
                        <input className="input" type={type || 'text'} min={type === 'number' ? 0 : undefined} value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                      )}
                    </Field>
                  ),
                )}
              </div>
            </Card>
          ))}
        </div>
        <div className="sticky bottom-4 flex justify-end">
          <button className="btn btn-primary shadow-2xl" disabled={busy}>
            {busy ? <Spinner className="!text-ink-950" /> : <SettingsIcon className="h-4 w-4" />} Save Settings
          </button>
        </div>
      </form>

      {/* Database Backup & Export Card */}
      <Card
        title="Database Backup & Export"
        subtitle="Export full database schema and all record data as a portable .sql dump"
        icon={Database}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4">
          <div>
            <div className="text-sm font-semibold text-white">Full Database SQL Dump</div>
            <div className="mt-1 text-xs text-zinc-400">
              Exports all tables (users, holdings, transactions, deposits, withdrawals, daily tasks, settings, etc.) with table schemas and INSERT statements.
            </div>
          </div>
          <button
            type="button"
            onClick={handleDownloadBackup}
            disabled={downloadingSql}
            className="btn btn-primary shrink-0 text-xs py-2 px-3 font-semibold flex items-center gap-2"
          >
            {downloadingSql ? <Spinner className="!text-ink-950" /> : <Download className="h-4 w-4" />}
            Download .SQL Backup
          </button>
        </div>
      </Card>
    </div>
  );
}

