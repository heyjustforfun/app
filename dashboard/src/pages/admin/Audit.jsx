import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import { useApi } from '../../context/AppContext';
import { dateTime } from '../../lib/api';
import { Card, ErrorBox, Loading, Pager } from '../../components/ui';

const LABELS = {
  'user.register': 'registered an account',
  'user.login': 'signed in',
  'user.login_failed': 'failed sign-in attempt on',
  'user.login_blocked': 'blocked sign-in (suspended) on',
  'user.logout': 'signed out',
  'user.profile_update': 'updated their profile',
  'user.password_change': 'changed their password',
  'kyc.submit': 'submitted identity documents',
  'kyc.verified': 'verified identity of',
  'kyc.rejected': 'rejected identity documents of',
  'deposit.submit': 'submitted a deposit',
  'deposit.approve': 'approved',
  'deposit.reject': 'rejected',
  'withdrawal.request': 'requested a withdrawal',
  'withdrawal.paid': 'marked as paid',
  'withdrawal.reject': 'rejected',
  'task.create': 'created daily task',
  'task.update': 'updated daily task',
  'task.delete': 'deleted daily task',
  'task.submit': 'submitted proof for daily task',
  'task.approve': 'approved daily task and credited reward for',
  'task.reject': 'rejected daily task submission of',
  'fund.invest': 'invested in',
  'fund.redeem': 'redeemed from',
  'fund.create': 'created',
  'fund.update': 'updated',
  'fund.nav_publish': 'published NAV for',
  'fund.nav_delete': 'deleted a NAV entry of',
  'admin.user_create': 'created',
  'admin.user_update': 'edited',
  'admin.user_suspend': 'suspended',
  'admin.user_activate': 'reactivated',
  'admin.user_password_reset': 'reset the password of',
  'admin.balance_adjust': 'adjusted the balance of',
  'admin.user_delete': 'deleted',
  'document.upload': 'published',
  'document.delete': 'deleted',
  'settings.update': 'updated platform settings',
};

export const actionLabel = (a) => LABELS[a] || a;

export default function Audit() {
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState('');
  const { data, loading, error, reload } = useApi(`/admin/audit?page=${page}&size=50${entity ? `&entity=${entity}` : ''}`);

  return (
    <Card
      title="Audit Log"
      subtitle="Every financial and administrative action, who did it, from which IP address, and what changed. Entries cannot be edited."
      icon={ScrollText}
      actions={
        <select className="input !w-48" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }}>
          <option value="">All entities</option>
          {['user', 'deposit', 'withdrawal', 'fund', 'document', 'settings'].map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      }
    >
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Details</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap text-zinc-500">{dateTime(e.created_at)}</td>
                    <td className="font-semibold text-white">{e.actor ? `@${e.actor}` : 'System'}</td>
                    <td className="whitespace-nowrap">
                      {actionLabel(e.action)}{' '}
                      <span className="text-zinc-500">
                        {e.entity} {e.entity_id ? `#${e.entity_id}` : ''}
                      </span>
                    </td>
                    <td className="max-w-md font-mono text-[11px] break-all text-zinc-500">{e.details}</td>
                    <td className="font-mono text-[11px] text-zinc-600">{e.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={data.page} size={data.size} total={data.total} onPage={setPage} />
        </>
      )}
    </Card>
  );
}
