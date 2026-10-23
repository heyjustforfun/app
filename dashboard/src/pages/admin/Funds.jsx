import { useEffect, useState } from 'react';
import { LineChart, Pencil, Plus, Trash2, TrendingUp } from 'lucide-react';
import { useApi, useToast } from '../../context/AppContext';
import { RISK, api, date, navFmt, pct, units, usd } from '../../lib/api';
import { Badge, Card, Empty, ErrorBox, Field, Loading, Modal, Spinner } from '../../components/ui';
import { TimeChart } from '../../components/charts';

const today = () => new Date().toISOString().slice(0, 10);

export default function Funds() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi('/admin/funds');
  const [edit, setEdit] = useState(null); // fund or {} for new
  const [navFund, setNavFund] = useState(null);

  return (
    <div className="space-y-6">
      <Card
        title="Funds & NAV Desk"
        subtitle="Publish each fund's net asset value per unit from your administrator or custodian valuation. Investors' balances revalue instantly."
        icon={LineChart}
        actions={
          <button className="btn btn-primary" onClick={() => setEdit({})}>
            <Plus className="h-4 w-4" /> New Fund
          </button>
        }
      >
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorBox error={error} onRetry={reload} />
        ) : data.funds.length === 0 ? (
          <Empty title="No funds yet" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Fund</th>
                  <th className="text-right">Current NAV</th>
                  <th className="text-right">Since launch</th>
                  <th className="text-right">Units outstanding</th>
                  <th className="text-right">AUM</th>
                  <th className="text-right">Investors</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.funds.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <div className="font-semibold text-white">{f.name}</div>
                      <span className={`mt-1 inline-block rounded border px-1.5 text-[10px] ${RISK[f.risk_level].cls}`}>{RISK[f.risk_level].label}</span>
                    </td>
                    <td className="text-right font-mono font-semibold text-white">
                      {Number(f.current_nav).toFixed(6)}
                      <div className="text-[10px] text-zinc-600">as of {date(f.history[f.history.length - 1]?.as_of)}</div>
                    </td>
                    <td className={`text-right font-mono ${(f.performance.since_inception ?? 0) >= 0 ? 'text-green-400' : 'text-rose-400'}`}>{pct(f.performance.since_inception)}</td>
                    <td className="text-right font-mono">{units(f.units_outstanding)}</td>
                    <td className="text-right font-mono font-semibold text-green-400">{usd(f.aum)}</td>
                    <td className="text-right font-mono">{f.investors}</td>
                    <td>
                      <Badge tone={f.status === 'open' ? 'green' : 'zinc'} className="uppercase">
                        {f.status}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex gap-1.5">
                        <button className="btn btn-primary btn-sm" onClick={() => setNavFund(f)}>
                          <TrendingUp className="h-3.5 w-3.5" /> Publish NAV
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEdit(f)}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <FundModal fund={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(); }} toast={toast} />
      <NavModal fund={navFund} onClose={() => setNavFund(null)} onDone={reload} toast={toast} />
    </div>
  );
}

function FundModal({ fund, onClose, onDone, toast }) {
  const isNew = fund && !fund.id;
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!fund) return;
    setForm(
      isNew
        ? { name: '', tagline: '', description: '', strategy: '', risk_level: 'medium', min_investment: 500, management_fee_pct: 1, status: 'open', sort_order: 0, initial_nav: 1 }
        : {
            name: fund.name,
            tagline: fund.tagline || '',
            description: fund.description || '',
            strategy: fund.strategy || '',
            risk_level: fund.risk_level,
            min_investment: fund.min_investment,
            management_fee_pct: fund.management_fee_pct,
            status: fund.status,
            sort_order: fund.sort_order,
          },
    );
  }, [fund, isNew]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(isNew ? '/admin/funds' : `/admin/funds/${fund.id}`, { method: isNew ? 'POST' : 'PUT', body: form });
      toast.success(isNew ? 'Fund created' : 'Fund updated');
      onDone();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!fund} onClose={onClose} title={isNew ? 'Create fund' : `Edit ${fund?.name || ''}`}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Fund name">
          <input className="input" required value={form.name || ''} onChange={set('name')} />
        </Field>
        <Field label="Tagline">
          <input className="input" value={form.tagline || ''} onChange={set('tagline')} />
        </Field>
        <Field label="Strategy">
          <input className="input" value={form.strategy || ''} onChange={set('strategy')} placeholder="e.g. Global equities" />
        </Field>
        <Field label="Description">
          <textarea className="input min-h-24" value={form.description || ''} onChange={set('description')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Risk level">
            <select className="input" value={form.risk_level || 'medium'} onChange={set('risk_level')}>
              <option value="low">Lower</option>
              <option value="medium">Medium</option>
              <option value="high">Higher</option>
            </select>
          </Field>
          <Field label="Min. investment ($)">
            <input className="input font-mono" type="number" min="1" step="1" required value={form.min_investment ?? ''} onChange={set('min_investment')} />
          </Field>
          <Field label="Mgmt. fee (% p.a.)">
            <input className="input font-mono" type="number" min="0" max="10" step="0.01" required value={form.management_fee_pct ?? ''} onChange={set('management_fee_pct')} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Status">
            <select className="input" value={form.status || 'open'} onChange={set('status')}>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </Field>
          <Field label="Display order">
            <input className="input font-mono" type="number" step="1" value={form.sort_order ?? 0} onChange={set('sort_order')} />
          </Field>
          {isNew && (
            <Field label="Launch NAV">
              <input className="input font-mono" type="number" min="0.000001" step="0.000001" required value={form.initial_nav ?? 1} onChange={set('initial_nav')} />
            </Field>
          )}
        </div>
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy && <Spinner className="!text-ink-950" />} {isNew ? 'Create Fund' : 'Save Changes'}
        </button>
      </form>
    </Modal>
  );
}

function NavModal({ fund, onClose, onDone, toast }) {
  const [form, setForm] = useState({ nav: '', as_of: today(), note: '' });
  const [busy, setBusy] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
  const history = useApi(fund ? `/funds/${fund.id}/nav` : null, [fund?.id]);

  useEffect(() => {
    if (fund) {
      setForm({ nav: fund.current_nav, as_of: today(), note: '' });
      setConfirmMsg('');
    }
  }, [fund]);

  const publish = async (e, confirmLarge = false) => {
    e?.preventDefault();
    setBusy(true);
    try {
      await api(`/admin/funds/${fund.id}/nav`, { method: 'POST', body: { ...form, confirm_large_change: confirmLarge } });
      toast.success(`NAV ${Number(form.nav).toFixed(6)} published for ${form.as_of}`);
      setConfirmMsg('');
      history.reload();
      onDone();
    } catch (err) {
      if (err.data?.needs_confirmation) setConfirmMsg(err.message);
      else toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (asOf) => {
    if (!confirm(`Delete the NAV entry for ${asOf}?`)) return;
    try {
      await api(`/admin/funds/${fund.id}/nav/${asOf}`, { method: 'DELETE' });
      history.reload();
      onDone();
    } catch (err) {
      toast.error(err);
    }
  };

  const rows = history.data?.history || [];
  const series = [...rows].reverse().map((h) => ({ date: h.as_of, value: h.nav }));

  return (
    <Modal open={!!fund} onClose={onClose} title={fund ? `Publish NAV · ${fund.name}` : ''} wide>
      {fund && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
          <form onSubmit={publish} className="space-y-4">
            <div className="rounded-xl border border-white/5 bg-ink-900 p-3 text-sm">
              Current NAV <b className="font-mono text-white">{Number(fund.current_nav).toFixed(6)}</b> · {units(fund.units_outstanding)} units outstanding
            </div>
            <Field label="NAV per unit" hint="Net of fees, from your fund administrator's valuation">
              <input className="input font-mono" type="number" min="0.000001" step="0.000001" required value={form.nav} onChange={(e) => setForm({ ...form, nav: e.target.value })} />
            </Field>
            {Number(form.nav) > 0 && (
              <p className="text-xs text-zinc-500">
                Change vs current: <b className="font-mono text-zinc-200">{pct((Number(form.nav) / fund.current_nav - 1) * 100, 3)}</b> · New AUM ≈{' '}
                <b className="font-mono text-zinc-200">{usd(fund.units_outstanding * Number(form.nav))}</b>
              </p>
            )}
            <Field label="Valuation date">
              <input className="input" type="date" max={today()} required value={form.as_of} onChange={(e) => setForm({ ...form, as_of: e.target.value })} />
            </Field>
            <Field label="Note (optional)">
              <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. Administrator valuation, month-end" />
            </Field>
            {confirmMsg ? (
              <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-200">
                {confirmMsg}
                <button type="button" className="btn btn-warn w-full" onClick={() => publish(null, true)} disabled={busy}>
                  I've double-checked: publish anyway
                </button>
              </div>
            ) : (
              <button className="btn btn-primary w-full" disabled={busy}>
                {busy && <Spinner className="!text-ink-950" />} Publish NAV
              </button>
            )}
          </form>
          <div>
            {series.length > 1 && <TimeChart data={series} height={180} format={(v) => Number(v).toFixed(4)} valueLabel="NAV" />}
            <div className="table-wrap mt-3 max-h-72 overflow-y-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="text-right">NAV</th>
                    <th>Note</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((h) => (
                    <tr key={h.as_of}>
                      <td className="whitespace-nowrap">{date(h.as_of)}</td>
                      <td className="text-right font-mono">{navFmt(h.nav)}</td>
                      <td className="text-xs text-zinc-500">{h.note || ''}</td>
                      <td>
                        {rows.length > 1 && (
                          <button className="text-zinc-600 hover:text-rose-400" onClick={() => remove(h.as_of)} title="Delete entry">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
