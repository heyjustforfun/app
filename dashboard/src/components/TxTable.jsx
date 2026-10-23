import { ArrowDownLeft, ArrowUpRight, PieChart, RotateCcw, SlidersHorizontal, TrendingUp } from 'lucide-react';
import { TX_LABELS, dateTime, signedUsd, units as fmtUnits, usd } from '../lib/api';
import { Empty } from './ui';

const ICONS = {
  deposit: [ArrowUpRight, 'text-green-400 bg-green-500/10'],
  withdrawal: [ArrowDownLeft, 'text-sky-400 bg-sky-500/10'],
  withdrawal_reversal: [RotateCcw, 'text-amber-400 bg-amber-500/10'],
  subscription: [PieChart, 'text-violet-300 bg-violet-500/10'],
  redemption: [TrendingUp, 'text-green-400 bg-green-500/10'],
  adjustment: [SlidersHorizontal, 'text-amber-400 bg-amber-500/10'],
};

export default function TxTable({ rows, empty = 'No transactions recorded yet.' }) {
  if (!rows?.length) return <Empty title={empty} text="Deposits, investments, redemptions and withdrawals will appear here." />;
  return (
    <div className="table-wrap print-plain">
      <table className="table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Description</th>
            <th className="text-right">Amount</th>
            <th className="text-right">Cash balance after</th>
            <th>Date & time</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const [Icon, cls] = ICONS[t.type] || ICONS.adjustment;
            return (
              <tr key={t.id}>
                <td>
                  <span className="flex items-center gap-2.5 whitespace-nowrap">
                    <span className={`no-print grid h-7 w-7 place-items-center rounded-lg ${cls}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="font-medium text-white">{TX_LABELS[t.type]}</span>
                  </span>
                </td>
                <td className="min-w-56 text-zinc-400">
                  {t.description}
                  {t.units != null && (
                    <span className="block font-mono text-[11px] text-zinc-600">
                      {Number(t.units) > 0 ? '+' : ''}
                      {fmtUnits(t.units)} units @ {Number(t.nav).toFixed(4)}
                    </span>
                  )}
                </td>
                <td className={`text-right font-mono font-semibold whitespace-nowrap ${Number(t.amount) >= 0 ? 'text-green-400' : 'text-zinc-200'}`}>
                  {signedUsd(t.amount)}
                </td>
                <td className="text-right font-mono whitespace-nowrap text-zinc-400">{usd(t.balance_after)}</td>
                <td className="whitespace-nowrap text-zinc-500">{dateTime(t.created_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
