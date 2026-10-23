import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Check, Inbox, Mail, RotateCcw } from 'lucide-react';
import { useApi, useToast } from '../../context/AppContext';
import { api, dateTime } from '../../lib/api';
import { Badge, Card, Empty, ErrorBox, Loading, Tabs } from '../../components/ui';

export default function Inquiries() {
  const { reloadStats } = useOutletContext();
  const toast = useToast();
  const [status, setStatus] = useState('new');
  const { data, loading, error, reload } = useApi(`/admin/inquiries?status=${status}`);

  const setState = async (q, next) => {
    try {
      await api(`/admin/inquiries/${q.id}/status`, { method: 'POST', body: { status: next } });
      reload();
      reloadStats();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <Card
      title="Website Inquiries"
      subtitle="Messages from the contact form on the public website"
      icon={Inbox}
      actions={<Tabs tabs={[['new', 'Open'], ['closed', 'Closed']]} value={status} onChange={setStatus} />}
    >
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : data.inquiries.length === 0 ? (
        <Empty icon={Inbox} title={status === 'new' ? 'Inbox zero' : 'No closed inquiries'} />
      ) : (
        <div className="space-y-3">
          {data.inquiries.map((q) => (
            <div key={q.id} className="rounded-xl border border-white/5 bg-ink-900 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-white">{q.name}</span>
                <a href={`mailto:${q.email}?subject=${encodeURIComponent(`Re: ${q.topic}`)}`} className="text-sm text-green-400 hover:underline">
                  {q.email}
                </a>
                <Badge tone="blue">{q.topic}</Badge>
                <span className="ml-auto text-xs text-zinc-600">{dateTime(q.created_at)}</span>
              </div>
              <p className="mt-2 text-sm whitespace-pre-wrap text-zinc-300">{q.message}</p>
              <div className="mt-3 flex gap-2">
                <a href={`mailto:${q.email}?subject=${encodeURIComponent(`Re: ${q.topic}`)}`} className="btn btn-ghost btn-sm">
                  <Mail className="h-3.5 w-3.5" /> Reply by email
                </a>
                {status === 'new' ? (
                  <button className="btn btn-primary btn-sm" onClick={() => setState(q, 'closed')}>
                    <Check className="h-3.5 w-3.5" /> Mark handled
                  </button>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={() => setState(q, 'new')}>
                    <RotateCcw className="h-3.5 w-3.5" /> Reopen
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
