import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ArrowDownLeft, Check, ShieldAlert, X } from 'lucide-react';
import { useApi, useToast } from '../../context/AppContext';
import { api, dateTime, usd } from '../../lib/api';
import { Card, Empty, ErrorBox, Field, Loading, Modal, Spinner, StatusBadge, Tabs } from '../../components/ui';

export default function Withdrawals() {
  const { reloadStats } = useOutletContext();
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const { data, loading, error, reload } = useApi(`/admin/withdrawals?status=${status}`);
  const [review, setReview] = useState(null); // { w, pay }
  const [form, setForm] = useState({ payout_reference: '', note: '' });
  const [busy, setBusy] = useState(false);

  const open = (w, pay) => {
    setForm({ payout_reference: '', note: '' });
    setReview({ w, pay });
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/admin/withdrawals/${review.w.id}/${review.pay ? 'pay' : 'reject'}`, { method: 'POST', body: form });
      toast.success(review.pay ? `Withdrawal #${review.w.id} marked as paid` : `Withdrawal #${review.w.id} rejected and funds returned`);
      setReview(null);
      reload();
      reloadStats();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Withdrawal Settlement Queue"
      subtitle="Funds are already reserved from the investor's balance. Send the bank transfer, then record its reference here."
      icon={ArrowDownLeft}
      actions={<Tabs tabs={[['pending', 'Pending'], ['paid', 'Paid'], ['rejected', 'Rejected']]} value={status} onChange={setStatus} />}
    >
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : data.withdrawals.length === 0 ? (
        <Empty title={`No ${status} withdrawals`} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Investor</th>
                <th className="text-right">Gross</th>
                <th className="text-right">Fee (20%)</th>
                <th className="text-right">Net to Send</th>
                <th>Pay to</th>
                <th>Requested</th>
                <th>{status === 'pending' ? 'Settlement' : 'Result'}</th>
              </tr>
            </thead>
            <tbody>
              {data.withdrawals.map((w) => {
                const nameMismatch = w.full_name && w.account_name.trim().toLowerCase() !== w.full_name.trim().toLowerCase();
                const gross = Number(w.amount || 0);
                const fee = Number(w.fee_amount != null ? w.fee_amount : gross * 0.20);
                const net = Number(w.net_amount != null ? w.net_amount : gross - fee);

                return (
                  <tr key={w.id}>
                    <td className="font-mono text-zinc-500">#{w.id}</td>
                    <td>
                      <div className="font-semibold text-white">@{w.username}</div>
                      <div className="text-[11px] text-zinc-600">{w.full_name || w.email}</div>
                      <div className="mt-1">
                        <StatusBadge status={w.kyc_status} />
                      </div>
                    </td>
                    <td className="text-right font-mono text-sm text-zinc-300">{usd(gross)}</td>
                    <td className="text-right font-mono text-xs font-semibold text-rose-400">-{usd(fee)}</td>
                    <td className="text-right font-mono text-base font-bold text-emerald-400">{usd(net)}</td>
                    <td className="text-xs">
                      <div className="font-semibold text-zinc-200">{w.bank_name}</div>
                      <div className="font-mono text-zinc-400">{w.account_number}</div>
                      <div className="text-zinc-500">{w.account_name}</div>
                      {nameMismatch && (
                        <div className="mt-1 flex items-center gap-1 text-amber-300">
                          <ShieldAlert className="h-3 w-3" /> Name differs from profile
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-zinc-500">{dateTime(w.created_at)}</td>
                    <td>
                      {status === 'pending' ? (
                        <div className="flex gap-1.5">
                          <button className="btn btn-primary btn-sm" onClick={() => open(w, true)}>
                            <Check className="h-3.5 w-3.5" /> Mark paid
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => open(w, false)}>
                            <X className="h-3.5 w-3.5" /> Reject
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs">
                          <StatusBadge status={w.status} />
                          {w.payout_reference && <div className="mt-1 font-mono text-zinc-400">Ref {w.payout_reference}</div>}
                          {w.admin_note && <div className="mt-0.5 max-w-56 text-zinc-400">{w.admin_note}</div>}
                          <div className="mt-0.5 text-zinc-600">
                            @{w.reviewed_by_name || '—'} · {dateTime(w.reviewed_at)}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!review} onClose={() => setReview(null)} title={review ? `${review.pay ? 'Settle' : 'Reject'} withdrawal #${review.w.id}` : ''}>
        {review && (
          <form onSubmit={submit} className="space-y-4">
            <div className="rounded-xl border border-white/5 bg-ink-900 p-4 text-sm space-y-2">
              <div className="flex justify-between items-center text-xs text-zinc-400">
                <span>Gross Requested:</span>
                <span className="font-mono font-semibold text-white">{usd(review.w.amount)}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-rose-400">
                <span>Company Fee (20% Retained):</span>
                <span className="font-mono font-semibold">
                  -{usd(Number(review.w.fee_amount != null ? review.w.fee_amount : review.w.amount * 0.20))}
                </span>
              </div>
              <div className="h-px bg-white/10" />
              <div className="flex justify-between items-center">
                <span className="text-emerald-300 font-bold">Net Transfer to Send:</span>
                <b className="font-mono text-xl font-bold text-emerald-400">
                  {usd(Number(review.w.net_amount != null ? review.w.net_amount : review.w.amount * 0.80))}
                </b>
              </div>
              <div className="mt-2 pt-2 border-t border-white/5 font-mono text-xs text-zinc-400">
                Pay to: <span className="text-white font-semibold">{review.w.account_name}</span> · {review.w.bank_name} · {review.w.account_number}
              </div>
            </div>
            {review.pay ? (
              <Field label="Bank transfer reference" hint="From your bank's outgoing payment confirmation">
                <input className="input font-mono" required value={form.payout_reference} onChange={(e) => setForm({ ...form, payout_reference: e.target.value })} />
              </Field>
            ) : (
              <p className="text-xs text-zinc-400">Rejecting returns the reserved gross amount to the investor's available cash.</p>
            )}
            <Field label={review.pay ? 'Internal note (optional)' : 'Reason shown to the investor'}>
              <input className="input" required={!review.pay} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </Field>
            <button className={`btn w-full ${review.pay ? 'btn-primary' : 'btn-danger'}`} disabled={busy}>
              {busy && <Spinner />} {review.pay ? `Confirm Net ${usd(Number(review.w.net_amount != null ? review.w.net_amount : review.w.amount * 0.80))} Payment Sent` : 'Reject & Return Funds'}
            </button>
          </form>
        )}
      </Modal>
    </Card>
  );
}
