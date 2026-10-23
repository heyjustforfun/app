import { useState } from 'react';
import { FolderOpen, Trash2, Upload } from 'lucide-react';
import { useApi, useToast } from '../../context/AppContext';
import { api, date, fileSize, upload } from '../../lib/api';
import { Badge, Card, Empty, ErrorBox, Field, Loading, Spinner } from '../../components/ui';

const EMPTY = { title: '', category: 'report', user_id: '', fund_id: '', file: null };

export default function Documents() {
  const toast = useToast();
  const docs = useApi('/admin/documents');
  const funds = useApi('/admin/funds');
  const [form, setForm] = useState(EMPTY);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await upload('/admin/documents', form);
      toast.success('Document published');
      setForm(EMPTY);
      setFileKey((k) => k + 1);
      docs.reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (d) => {
    if (!confirm(`Delete "${d.title}"? Investors will no longer be able to download it.`)) return;
    try {
      await api(`/admin/documents/${d.id}`, { method: 'DELETE' });
      docs.reload();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
      <Card title="Publish a document" icon={Upload}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Title">
            <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Q3 2026 Investor Report" />
          </Field>
          <Field label="Category">
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="report">Report</option>
              <option value="factsheet">Factsheet</option>
              <option value="statement">Statement</option>
              <option value="legal">Legal</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Related fund (optional)">
            <select className="input" value={form.fund_id} onChange={(e) => setForm({ ...form, fund_id: e.target.value })}>
              <option value="">—</option>
              {funds.data?.funds.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Visible to" hint="Leave empty to share with all investors, or enter a user ID for a personal statement">
            <input className="input font-mono" type="number" min="1" placeholder="All investors" value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })} />
          </Field>
          <Field label="File (PDF or image, max 8 MB)">
            <input key={fileKey} className="input" type="file" required accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => setForm({ ...form, file: e.target.files[0] || null })} />
          </Field>
          <button className="btn btn-primary w-full" disabled={busy}>
            {busy ? <Spinner className="!text-ink-950" /> : <Upload className="h-4 w-4" />} Publish
          </button>
        </form>
      </Card>

      <Card title="Published documents" icon={FolderOpen}>
        {docs.loading && !docs.data ? (
          <Loading />
        ) : docs.error ? (
          <ErrorBox error={docs.error} onRetry={docs.reload} />
        ) : docs.data.documents.length === 0 ? (
          <Empty title="No documents published yet" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Audience</th>
                  <th>Size</th>
                  <th>Published</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {docs.data.documents.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <a href={`/api/documents/${d.id}/download`} className="font-semibold text-white hover:text-green-400">
                        {d.title}
                      </a>
                      {d.fund_name && <div className="text-[11px] text-zinc-600">{d.fund_name}</div>}
                    </td>
                    <td className="capitalize">{d.category}</td>
                    <td>{d.user_id ? <Badge tone="blue">@{d.username}</Badge> : <Badge tone="green">All investors</Badge>}</td>
                    <td className="text-zinc-500">{fileSize(d.size)}</td>
                    <td className="whitespace-nowrap text-zinc-500">{date(d.created_at)}</td>
                    <td>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(d)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
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
