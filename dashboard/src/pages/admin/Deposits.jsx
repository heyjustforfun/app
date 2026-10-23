import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Check, Copy, ExternalLink, Eye, Layers, X, ZoomIn } from 'lucide-react';
import { useApi, useToast } from '../../context/AppContext';
import { api, dateTime, usd } from '../../lib/api';
import { Card, Empty, ErrorBox, Field, Loading, Modal, Spinner, StatusBadge, Tabs } from '../../components/ui';

function TxCopy({ value }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="text-zinc-600">—</span>;
  return (
    <div className="inline-flex items-center gap-1.5 font-mono text-xs">
      <span className="text-amber-300 font-medium select-all">{value}</span>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="text-zinc-500 hover:text-white transition-colors"
        title="Copy Transaction ID"
      >
        {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}

export default function Deposits() {
  const { reloadStats } = useOutletContext();
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const { data, loading, error, reload } = useApi(`/admin/deposits?status=${status}`);
  const [review, setReview] = useState(null); // { deposit, approve }
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [previewImage, setPreviewImage] = useState(null); // { url, title, reference }

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/admin/deposits/${review.deposit.id}/${review.approve ? 'approve' : 'reject'}`, { method: 'POST', body: { note } });
      toast.success(review.approve ? `Deposit #${review.deposit.id} approved and credited` : `Deposit #${review.deposit.id} rejected`);
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
      title="Deposit Review Queue"
      subtitle="Verify the customer's attached payment screenshot and TxID before approving. Approval credits cash instantly."
      icon={Layers}
      actions={<Tabs tabs={[['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']]} value={status} onChange={setStatus} />}
    >
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : data.deposits.length === 0 ? (
        <Empty title={`No ${status} deposits`} text={`There are currently no ${status} deposit requests in the queue.`} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Investor</th>
                <th className="text-right">Amount</th>
                <th>Method & TxID</th>
                <th>Payment Proof</th>
                <th>Submitted</th>
                <th>{status === 'pending' ? 'Decision' : 'Review'}</th>
              </tr>
            </thead>
            <tbody>
              {data.deposits.map((d) => (
                <tr key={d.id}>
                  <td className="font-mono text-zinc-500">#{d.id}</td>
                  <td>
                    <div className="font-semibold text-white">@{d.username}</div>
                    <div className="text-[11px] text-zinc-500">{d.email}</div>
                  </td>
                  <td className="text-right font-mono text-base font-bold text-amber-400">{usd(d.amount)}</td>
                  <td>
                    <div className="font-medium text-white text-xs">{d.method}</div>
                    <div className="mt-0.5">
                      <TxCopy value={d.reference} />
                    </div>
                  </td>
                  <td>
                    {d.has_receipt ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewImage({ 
                            url: `/api/deposits/${d.id}/receipt`, 
                            title: `Deposit #${d.id} Payment Proof · @${d.username} (${usd(d.amount)})`, 
                            reference: d.reference 
                          })}
                          className="group relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/40 hover:border-amber-400/60 transition-all cursor-pointer shadow-sm"
                          title="Click to preview payment screenshot"
                        >
                          <img
                            src={`/api/deposits/${d.id}/receipt`}
                            alt="Proof"
                            className="h-full w-full object-cover group-hover:scale-110 transition-transform"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Eye className="h-3.5 w-3.5 text-white" />
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewImage({ 
                            url: `/api/deposits/${d.id}/receipt`, 
                            title: `Deposit #${d.id} Payment Proof · @${d.username} (${usd(d.amount)})`, 
                            reference: d.reference 
                          })}
                          className="text-xs text-green-400 hover:text-green-300 font-medium hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="h-3 w-3" /> View Proof
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-600">No image</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-zinc-500">{dateTime(d.created_at)}</td>
                  <td>
                    {status === 'pending' ? (
                      <div className="flex gap-1.5">
                        <button className="btn btn-primary btn-sm" onClick={() => { setNote(''); setReview({ deposit: d, approve: true }); }}>
                          <Check className="h-3.5 w-3.5" /> Approve
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => { setNote(''); setReview({ deposit: d, approve: false }); }}>
                          <X className="h-3.5 w-3.5" /> Reject
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs">
                        <StatusBadge status={d.status} />
                        <div className="mt-1 text-zinc-500">
                          by @{d.reviewed_by_name || '—'} · {dateTime(d.reviewed_at)}
                        </div>
                        {d.admin_note && <div className="mt-0.5 max-w-56 text-zinc-400">{d.admin_note}</div>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Review Modal with Attached Image & Details */}
      <Modal open={!!review} onClose={() => setReview(null)} title={review ? `${review.approve ? 'Approve' : 'Reject'} deposit #${review.deposit.id}` : ''}>
        {review && (
          <form onSubmit={submit} className="space-y-4">
            <div className="rounded-xl border border-white/5 bg-ink-900 p-4 text-sm space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-zinc-500">Deposit Amount:</span>
                  <div className="font-mono text-xl font-bold text-amber-400">{usd(review.deposit.amount)}</div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-zinc-500">Investor:</span>
                  <div className="font-semibold text-white">@{review.deposit.username}</div>
                </div>
              </div>

              <div className="border-t border-white/5 pt-2 flex items-center justify-between text-xs">
                <span className="text-zinc-500">Method:</span>
                <span className="font-medium text-white">{review.deposit.method}</span>
              </div>

              <div className="border-t border-white/5 pt-2 flex items-center justify-between text-xs">
                <span className="text-zinc-500">TxID / Reference:</span>
                <span className="font-mono text-amber-300 font-bold select-all">{review.deposit.reference || '—'}</span>
              </div>

              {/* Direct Screenshot Display inside Modal */}
              {review.deposit.has_receipt && (
                <div className="mt-3 pt-3 border-t border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5 text-amber-400" /> Attached Payment Screenshot:
                    </span>
                    <a
                      className="inline-flex items-center gap-1 text-[11px] text-green-400 hover:underline"
                      href={`/api/deposits/${review.deposit.id}/receipt`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="h-3 w-3" /> Full Size
                    </a>
                  </div>

                  <div 
                    onClick={() => setPreviewImage({ 
                      url: `/api/deposits/${review.deposit.id}/receipt`, 
                      title: `Deposit #${review.deposit.id} Payment Proof · @${review.deposit.username}`,
                      reference: review.deposit.reference 
                    })}
                    className="relative group cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-black/60 p-1 flex items-center justify-center max-h-56"
                    title="Click to zoom screenshot"
                  >
                    <img
                      src={`/api/deposits/${review.deposit.id}/receipt`}
                      alt="Payment screenshot"
                      className="max-h-52 w-auto max-w-full object-contain rounded-lg group-hover:scale-102 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-xs font-semibold text-white gap-1.5 rounded-lg">
                      <ZoomIn className="h-4 w-4" /> Click to Zoom
                    </div>
                  </div>
                </div>
              )}
            </div>

            {review.approve ? (
              <p className="text-xs text-zinc-400 bg-green-500/10 border border-green-500/20 p-2.5 rounded-lg text-green-200">
                Approving this request will immediately credit <b className="text-white font-mono">{usd(review.deposit.amount)}</b> to @{review.deposit.username}&apos;s cash balance and send them a confirmation notification.
              </p>
            ) : (
              <p className="text-xs text-zinc-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg text-rose-200">
                Rejecting this request will mark it as rejected. Please provide a clear reason for the investor below.
              </p>
            )}

            <Field label={review.approve ? 'Internal note (optional)' : 'Reason shown to the investor'}>
              <input className="input" required={!review.approve} value={note} onChange={(e) => setNote(e.target.value)} placeholder={review.approve ? "e.g. Verified via Binance TxID" : "e.g. TxID could not be verified on Binance"} />
            </Field>

            <button className={`btn w-full py-2.5 ${review.approve ? 'btn-primary' : 'btn-danger'}`} disabled={busy}>
              {busy && <Spinner />} Confirm {review.approve ? 'Approval & Credit Funds' : 'Rejection'}
            </button>
          </form>
        )}
      </Modal>

      {/* Standalone Full-Resolution Image Preview Modal */}
      <Modal open={!!previewImage} onClose={() => setPreviewImage(null)} title={previewImage?.title || 'Payment Proof Screenshot'}>
        {previewImage && (
          <div className="space-y-4">
            {previewImage.reference && (
              <div className="flex items-center justify-between rounded-lg border border-white/5 bg-ink-900 px-3 py-2 text-xs">
                <span className="text-zinc-400">Transaction ID (TxID):</span>
                <span className="font-mono text-amber-300 font-bold select-all">{previewImage.reference}</span>
              </div>
            )}
            <div className="overflow-hidden rounded-xl border border-white/10 bg-black flex items-center justify-center p-2 max-h-[65vh]">
              <img
                src={previewImage.url}
                alt="Payment Proof Full"
                className="max-h-[60vh] w-auto max-w-full object-contain rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <a
                href={previewImage.url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost btn-sm inline-flex items-center gap-1.5"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open in New Tab
              </a>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="btn btn-primary btn-sm"
              >
                Close Preview
              </button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}

