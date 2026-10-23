import { Download, FileText } from 'lucide-react';
import { useApi } from '../../context/AppContext';
import { date, fileSize } from '../../lib/api';
import { Badge, Card, Empty, ErrorBox, Loading } from '../../components/ui';

const CATEGORY = { report: 'Report', factsheet: 'Factsheet', statement: 'Statement', legal: 'Legal', other: 'Other' };

export default function Documents() {
  const { data, loading, error, reload } = useApi('/documents');
  return (
    <Card title="Documents" subtitle="Fund reports, factsheets, legal documents and your personal statements" icon={FileText}>
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : data.documents.length === 0 ? (
        <Empty icon={FileText} title="No documents yet" text="When we publish fund reports or statements for you, they'll appear here." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.documents.map((d) => (
            <a
              key={d.id}
              href={`/api/documents/${d.id}/download`}
              className="group flex items-center gap-4 rounded-xl border border-white/5 bg-ink-900 p-4 transition hover:border-green-500/30"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-green-500/10 text-green-400">
                <FileText className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-white">{d.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <Badge tone={d.personal ? 'green' : 'zinc'}>{d.personal ? 'For you' : CATEGORY[d.category]}</Badge>
                  {d.fund_name && <span>{d.fund_name}</span>}
                  <span>{date(d.created_at)}</span>
                  <span>{fileSize(d.size)}</span>
                </div>
              </div>
              <Download className="h-4 w-4 text-zinc-500 transition group-hover:text-green-400" />
            </a>
          ))}
        </div>
      )}
    </Card>
  );
}
