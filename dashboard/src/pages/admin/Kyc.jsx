import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { BadgeCheck, Check, Eye, X } from 'lucide-react';
import { useApi, useToast } from '../../context/AppContext';
import { api, date } from '../../lib/api';
import { Card, Empty, ErrorBox, Loading, StatusBadge, Tabs } from '../../components/ui';

export default function Kyc() {
  const { reloadStats } = useOutletContext();
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const { data, loading, error, reload } = useApi(`/admin/users?kyc=${status}&size=200`);

  const decide = async (u, verified) => {
    let note = null;
    if (!verified) {
      note = prompt(`Reason for rejecting @${u.username}'s documents (shown to the investor):`);
      if (!note) return;
    }
    try {
      await api(`/admin/users/${u.id}/kyc`, { method: 'POST', body: { status: verified ? 'verified' : 'rejected', note } });
      toast.success(`@${u.username} ${verified ? 'verified' : 'rejected'}`);
      reload();
      reloadStats();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <Card
      title="Identity Verification Reviews"
      subtitle="Check that the document is genuine, legible and matches the account holder's name. One ID per account is enforced automatically."
      icon={BadgeCheck}
      actions={<Tabs tabs={[['pending', 'Pending'], ['verified', 'Verified'], ['rejected', 'Rejected']]} value={status} onChange={setStatus} />}
    >
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : data.users.length === 0 ? (
        <Empty icon={BadgeCheck} title={`No ${status} verifications`} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Investor</th>
                <th>Full name</th>
                <th>ID number</th>
                <th>Document</th>
                <th>Joined</th>
                <th>{status === 'pending' ? 'Decision' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="font-semibold text-white">@{u.username}</div>
                    <div className="text-[11px] text-zinc-600">{u.email}</div>
                  </td>
                  <td className="text-zinc-200">{u.full_name || '—'}</td>
                  <td className="font-mono text-green-400">{u.national_id || '—'}</td>
                  <td>
                    {u.has_kyc_document ? (
                      <a className="btn btn-ghost btn-sm" href={`/api/admin/users/${u.id}/kyc-document`} target="_blank" rel="noreferrer">
                        <Eye className="h-3.5 w-3.5" /> Open
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="text-zinc-500">{date(u.created_at)}</td>
                  <td>
                    {status === 'pending' ? (
                      <div className="flex gap-1.5">
                        <button className="btn btn-primary btn-sm" onClick={() => decide(u, true)}>
                          <Check className="h-3.5 w-3.5" /> Verify
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => decide(u, false)}>
                          <X className="h-3.5 w-3.5" /> Reject
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs">
                        <StatusBadge status={u.kyc_status} />
                        {u.kyc_note && <div className="mt-1 max-w-56 text-zinc-500">{u.kyc_note}</div>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
