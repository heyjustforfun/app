import { useState } from 'react';
import { Check, Copy, Download, Landmark, Receipt, Scan, ShieldCheck, Upload, Zap } from 'lucide-react';
import { useApi, useAuth, useToast } from '../../context/AppContext';
import { dateTime, upload, usd } from '../../lib/api';
import { Card, Empty, ErrorBox, Field, Loading, Spinner, StatusBadge } from '../../components/ui';
import binanceQr from '../../assets/binance-qr.png';

function CopyRow({ label, value }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-2.5 last:border-0">
      <span className="text-xs text-zinc-500">{label}</span>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="flex items-center gap-2 text-right font-mono text-sm text-white hover:text-green-400"
      >
        {value} {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5 text-zinc-600" />}
      </button>
    </div>
  );
}

const PACKAGES = [250, 500, 1000];

export default function Deposit() {
  const { user } = useAuth();
  const toast = useToast();
  const info = useApi('/deposits/instructions');
  const list = useApi('/deposits');
  
  const [activeTab, setActiveTab] = useState('binance'); // 'binance' | 'bank'
  const [form, setForm] = useState({ 
    amount: '250', 
    method: 'Binance (Pay ID)', 
    reference: '', 
    receipt: null 
  });
  const [busy, setBusy] = useState(false);
  const [fileKey, setFileKey] = useState(0);
  const [copiedBinance, setCopiedBinance] = useState(false);

  const ins = info.data?.instructions;
  const binanceId = ins?.binance_id || '1282494665';
  const bankReady = ins && (ins.bank_account_number || ins.bank_iban);

  const handleCopyBinance = () => {
    navigator.clipboard?.writeText(binanceId);
    setCopiedBinance(true);
    toast.success(`Binance ID ${binanceId} copied!`);
    setTimeout(() => setCopiedBinance(false), 2000);
  };

  const handleMethodChange = (e) => {
    const val = e.target.value;
    setForm({ ...form, method: val });
    if (val.toLowerCase().includes('binance')) {
      setActiveTab('binance');
    } else if (val.toLowerCase().includes('bank')) {
      setActiveTab('bank');
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'binance' && !form.method.toLowerCase().includes('binance')) {
      setForm({ ...form, method: 'Binance (Pay ID)' });
    } else if (tab === 'bank' && form.method.toLowerCase().includes('binance')) {
      setForm({ ...form, method: 'Bank wire' });
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.receipt && !form.reference) {
      toast.error('Please enter the Transaction ID / TxID or upload a payment screenshot.');
      return;
    }
    setBusy(true);
    try {
      await upload('/deposits', form);
      toast.success('Deposit submitted successfully! Our treasury team will credit your balance once confirmed.');
      setForm({ 
        amount: '250', 
        method: activeTab === 'binance' ? 'Binance (Pay ID)' : 'Bank wire', 
        reference: '', 
        receipt: null 
      });
      setFileKey((k) => k + 1);
      list.reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Deposit Instructions */}
        <Card 
          title="1. Send Payment" 
          subtitle="Choose your preferred deposit method and transfer funds" 
          icon={Zap}
        >
          {/* Method Selector Tabs */}
          <div className="mb-5 flex rounded-xl border border-white/5 bg-ink-950/70 p-1">
            <button
              type="button"
              onClick={() => handleTabChange('binance')}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all ${
                activeTab === 'binance'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Zap className="h-3.5 w-3.5 text-amber-400" /> Binance Pay (Instant)
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('bank')}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all ${
                activeTab === 'bank'
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Landmark className="h-3.5 w-3.5 text-green-400" /> Bank Wire
            </button>
          </div>

          {info.loading ? (
            <Loading />
          ) : activeTab === 'binance' ? (
            /* Binance Deposit Display */
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 font-black text-xl shadow-inner">
                      B
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wider text-amber-400 font-bold">Binance ID (Pay / Send)</div>
                      <div className="text-xs text-zinc-400">Instant USDT / Crypto Transfer</div>
                    </div>
                  </div>
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                    Active & Verified
                  </span>
                </div>

                {/* Binance ID Copy Card */}
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/50 p-3.5 backdrop-blur">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-zinc-400">Recipient Binance ID</div>
                    <div className="font-mono text-2xl font-black tracking-widest text-white">
                      {binanceId}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyBinance}
                    className="btn btn-sm bg-amber-400 hover:bg-amber-300 text-black font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                  >
                    {copiedBinance ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiedBinance ? 'Copied!' : 'Copy Binance ID'}
                  </button>
                </div>

                {/* Scan to Pay / QR Code Section */}
                <div className="mt-4 rounded-xl border border-amber-500/25 bg-black/45 p-4 backdrop-blur">
                  <div className="flex items-center justify-between mb-3">
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
                      <Scan className="h-3.5 w-3.5 text-amber-400" /> Scan to Pay or Deposit
                    </div>
                    <span className="text-[11px] text-zinc-400 font-mono">Binance Pay</span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    {/* QR Code Container */}
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="relative group overflow-hidden rounded-2xl border-2 border-amber-400/50 bg-white p-2.5 shadow-xl shadow-amber-500/10 transition-transform hover:scale-[1.02]">
                        <img 
                          src={binanceQr} 
                          alt="Binance Pay QR Code - Scan to Pay" 
                          className="h-40 w-40 object-contain rounded-lg"
                        />
                      </div>
                      <a
                        href={binanceQr}
                        download="binance-pay-qr-1282494665.png"
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 hover:text-amber-300 hover:underline transition-colors"
                      >
                        <Download className="h-3 w-3" /> Save QR Code
                      </a>
                    </div>

                    {/* QR Scan Info */}
                    <div className="space-y-2 text-center sm:text-left">
                      <h4 className="text-sm font-bold text-white">
                        Scan with your Binance App
                      </h4>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        Open the <b className="text-amber-300">Binance App</b>, tap the QR Scanner icon in the top right corner, and scan this code to transfer funds instantly.
                      </p>
                      <div className="rounded-lg border border-white/5 bg-white/5 p-2.5 text-[11px] text-zinc-400">
                        <div className="text-zinc-500">Supported Currencies:</div>
                        <div className="font-medium text-zinc-200">USDT, USDC, BUSD, BTC, ETH & more</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Steps Guide */}
                <div className="mt-4 space-y-2 rounded-xl border border-white/5 bg-black/30 p-3.5 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-200">
                    <ShieldCheck className="h-4 w-4 text-amber-400" /> Steps to deposit via Binance:
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-zinc-300 pt-1">
                    <li><b className="text-amber-300">Scan the QR code above</b> with your Binance scanner, or manually enter Binance ID <span className="font-mono font-bold text-amber-400">{binanceId}</span>.</li>
                    <li>Select one of our investment packages: <b className="text-amber-300 font-mono">$250</b>, <b className="text-amber-300 font-mono">$500</b>, or <b className="text-amber-300 font-mono">$1,000</b> (USDT).</li>
                    <li>Transfer the exact package amount and confirm the payment.</li>
                    <li>Save your <b className="text-white">Transaction ID / Order ID</b> and take a <b className="text-white">screenshot</b> of the payment receipt.</li>
                    <li>Choose your package on the right, paste your Transaction ID, upload the screenshot, and click <b className="text-green-400">Submit Deposit Request</b>.</li>
                  </ol>
                </div>

                <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-zinc-300 font-medium">Available Packages:</span>
                    <div className="flex items-center gap-1.5 font-mono font-bold text-amber-300">
                      <span className="rounded bg-black/40 border border-amber-500/30 px-2 py-0.5">$250</span>
                      <span>·</span>
                      <span className="rounded bg-black/40 border border-amber-500/30 px-2 py-0.5">$500</span>
                      <span>·</span>
                      <span className="rounded bg-black/40 border border-amber-500/30 px-2 py-0.5">$1,000</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Bank Wire Deposit Display */
            <div>
              {bankReady ? (
                <div>
                  <CopyRow label="Bank" value={ins.bank_name} />
                  <CopyRow label="Account name" value={ins.bank_account_name} />
                  <CopyRow label="Account number" value={ins.bank_account_number} />
                  <CopyRow label="IBAN" value={ins.bank_iban} />
                  <CopyRow label="SWIFT / BIC" value={ins.bank_swift} />
                  <CopyRow label="Payment reference" value={user.username} />
                  {ins.deposit_instructions && (
                    <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
                      {ins.deposit_instructions}
                    </p>
                  )}
                  <div className="mt-4 rounded-xl border border-white/5 bg-black/40 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400 font-medium">Deposit Packages:</span>
                      <div className="flex items-center gap-1.5 font-mono font-bold text-green-300">
                        <span className="rounded bg-white/5 border border-white/10 px-2 py-0.5">$250</span>
                        <span>·</span>
                        <span className="rounded bg-white/5 border border-white/10 px-2 py-0.5">$500</span>
                        <span>·</span>
                        <span className="rounded bg-white/5 border border-white/10 px-2 py-0.5">$1,000</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Empty 
                    icon={Landmark} 
                    title="Direct Bank Wire Coming Soon" 
                    text="Our bank wire details are being updated. We recommend depositing via Binance Pay (Instant) or contacting Support for manual wire assistance." 
                  />
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => handleTabChange('binance')}
                      className="btn btn-sm btn-primary inline-flex items-center gap-1.5"
                    >
                      <Zap className="h-4 w-4" /> Switch to Binance Pay (ID: {binanceId})
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Right Column: Deposit Notification Form */}
        <Card 
          title="2. Submit Deposit Request" 
          subtitle="Provide your transfer details so our treasury team can verify and credit your cash balance" 
          icon={Receipt}
        >
          <form onSubmit={submit} className="space-y-4">
            {/* 3 Package Selection Options ($250, $500, $1,000) */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Choose Investment Package
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {PACKAGES.map((pkg) => {
                  const isSelected = Number(form.amount) === pkg;
                  return (
                    <button
                      key={pkg}
                      type="button"
                      onClick={() => setForm({ ...form, amount: String(pkg) })}
                      className={`relative flex flex-col items-center justify-center rounded-xl p-3 transition-all text-center border cursor-pointer ${
                        isSelected
                          ? 'border-amber-400 bg-amber-500/20 text-white shadow-lg shadow-amber-500/20 ring-1 ring-amber-400 scale-[1.02]'
                          : 'border-white/10 bg-black/40 text-zinc-400 hover:border-white/20 hover:text-white hover:bg-black/60'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute -top-1.5 -right-1 rounded-full bg-amber-400 p-0.5 text-black shadow">
                          <Check className="h-3 w-3 stroke-[3]" />
                        </div>
                      )}
                      <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                        {pkg === 250 ? 'Starter' : pkg === 500 ? 'Standard' : 'Premium'}
                      </span>
                      <span className="font-mono text-base sm:text-lg font-black text-white mt-0.5">
                        ${pkg.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-amber-300 font-medium">
                        {pkg} USDT
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Selected Package Confirmation Banner */}
              <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-xs">
                <span className="text-zinc-400">Selected Package Amount:</span>
                <span className="font-mono text-sm font-bold text-amber-300">
                  ${Number(form.amount || 250).toLocaleString()} USD / USDT
                </span>
              </div>
            </div>

            <Field label="Deposit Method">
              <select 
                className="input" 
                value={form.method} 
                onChange={handleMethodChange}
              >
                <option value="Binance (Pay ID)">Binance (Pay ID / Transfer)</option>
                <option value="Bank wire">Bank wire transfer</option>
                <option value="Local bank transfer">Local bank transfer</option>
                <option value="Other">Other</option>
              </select>
            </Field>

            <Field 
              label={form.method.toLowerCase().includes('binance') ? "Binance Transaction ID / TxID / Order ID" : "Transfer reference"} 
              hint={form.method.toLowerCase().includes('binance') ? "Enter your Binance Order ID, TxID, or sender Binance ID" : "The reference shown on your bank's confirmation"}
            >
              <input 
                className="input font-mono" 
                placeholder={form.method.toLowerCase().includes('binance') ? "e.g. 2938472918 or Binance Order ID" : user.username}
                value={form.reference} 
                onChange={(e) => setForm({ ...form, reference: e.target.value })} 
              />
            </Field>

            <Field 
              label="Payment Screenshot / Receipt (PDF or Image, max 8 MB)"
              hint="Attach a screenshot of the completed transfer showing the amount and confirmation"
            >
              <input 
                key={fileKey} 
                className="input file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20 cursor-pointer" 
                type="file" 
                accept="application/pdf,image/png,image/jpeg,image/webp" 
                onChange={(e) => setForm({ ...form, receipt: e.target.files[0] || null })} 
              />
            </Field>

            <button className="btn btn-primary w-full py-3 font-semibold text-sm" disabled={busy}>
              {busy ? <Spinner className="!text-ink-950" /> : <Upload className="h-4 w-4" />} Submit Deposit Request
            </button>
            <p className="text-center text-[11px] text-zinc-500">
              Your deposit request will be reviewed by admin treasury. Your account balance will be credited upon confirmation.
            </p>
          </form>
        </Card>
      </div>

      {/* Deposit History */}
      <Card title="Deposit History">
        {list.loading && !list.data ? (
          <Loading />
        ) : list.error ? (
          <ErrorBox error={list.error} onRetry={list.reload} />
        ) : list.data.deposits.length === 0 ? (
          <Empty title="No deposits yet" text="When you submit a deposit request, it will appear here with its review status." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th className="text-right">Amount</th>
                  <th>Method</th>
                  <th>TxID / Reference</th>
                  <th>Receipt / Screenshot</th>
                  <th>Status</th>
                  <th>Admin Note</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {list.data.deposits.map((d) => (
                  <tr key={d.id}>
                    <td className="font-mono text-zinc-500">#{d.id}</td>
                    <td className="text-right font-mono font-semibold text-white">{usd(d.amount)}</td>
                    <td>
                      <span className={`inline-flex items-center gap-1.5 text-xs ${
                        d.method.toLowerCase().includes('package')
                          ? 'font-medium text-emerald-400'
                          : d.method.toLowerCase().includes('binance')
                          ? 'text-amber-300'
                          : 'text-zinc-300'
                      }`}>
                        {d.method.toLowerCase().includes('package') && <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />}
                        {d.method.toLowerCase().includes('binance') && <Zap className="h-3 w-3 text-amber-400" />}
                        {d.method}
                      </span>
                    </td>
                    <td className="font-mono text-xs">
                      {d.reference || '—'}
                    </td>
                    <td>
                      {d.has_receipt ? (
                        <a className="inline-flex items-center gap-1 text-xs text-green-400 hover:underline" href={`/api/deposits/${d.id}/receipt`} target="_blank" rel="noreferrer">
                          <Receipt className="h-3.5 w-3.5" /> View screenshot
                        </a>
                      ) : d.method.toLowerCase().includes('package') ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400/90">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Admin Activated
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-600">—</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="max-w-56 text-xs text-zinc-500">{d.admin_note || '—'}</td>
                    <td className="whitespace-nowrap text-zinc-500">{dateTime(d.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

