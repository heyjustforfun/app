import { useState } from 'react';
import { Printer } from 'lucide-react';
import { useApi, useAuth } from '../../context/AppContext';
import { BRAND, dateTime, usd } from '../../lib/api';
import { Card, ErrorBox, Loading, Pager, Tabs } from '../../components/ui';
import TxTable from '../../components/TxTable';

const TYPES = [
  ['', 'All'],
  ['deposit', 'Deposits'],
  ['subscription', 'Investments'],
  ['redemption', 'Redemptions'],
  ['withdrawal', 'Withdrawals'],
  ['adjustment', 'Adjustments'],
];

export default function Transactions() {
  const { user } = useAuth();
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApi(`/me/transactions?page=${page}&size=50${type ? `&type=${type}` : ''}`);

  return (
    <Card
      title="Account Statement"
      subtitle="Every movement in your cash balance, with the running balance after each entry"
      actions={
        <button className="btn btn-ghost btn-sm no-print" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print / Save PDF
        </button>
      }
      className="print-plain"
    >
      <div className="mb-4 hidden print:block">
        <div className="text-lg font-bold">{BRAND.name} — Account Statement</div>
        <div className="text-sm">
          {user.full_name || user.username} · {user.email} · Generated {dateTime(new Date())} · Cash balance {usd(user.cash_balance)}
        </div>
      </div>
      <div className="no-print mb-4">
        <Tabs
          tabs={TYPES}
          value={type}
          onChange={(t) => {
            setType(t);
            setPage(1);
          }}
        />
      </div>
      {loading && !data ? <Loading /> : error ? <ErrorBox error={error} onRetry={reload} /> : <TxTable rows={data.transactions} />}
      {data && <div className="no-print"><Pager page={data.page} size={data.size} total={data.total} onPage={setPage} /></div>}
    </Card>
  );
}
