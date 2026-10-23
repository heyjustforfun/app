import { navFmt, pct, usd } from '../lib/api';

export default function Ticker({ funds, market }) {
  const items = [
    ...funds.map((f) => ({ label: f.name.toUpperCase(), value: `NAV ${navFmt(f.current_nav)}`, change: f.performance?.change_1d })),
    ...market.map((m) => ({ label: m.symbol, value: usd(m.price, m.price < 10 ? 4 : 2), change: m.change24h })),
  ];
  if (!items.length) return null;
  const row = [...items, ...items];

  return (
    <div className="relative z-50 border-b border-white/5 bg-ink-950">
      <div className="mx-auto flex w-full max-w-[1720px] items-center px-4 sm:px-8 lg:px-12 xl:px-16">
        <div className="flex shrink-0 items-center gap-2 py-2 pr-4 text-[11px] font-semibold tracking-wider text-green-400">
          <span className="live-dot" />
          LIVE MARKETS
        </div>
        <div className="mask-fade-x relative flex-1 overflow-hidden">
          <div className="marquee flex gap-10 py-2 whitespace-nowrap">
            {row.map((it, i) => (
              <span key={i} className="flex items-center gap-2 font-mono text-xs text-zinc-400">
                <span className="font-semibold text-zinc-200">{it.label}</span>
                {it.value}
                {it.change != null && (
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${it.change >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-rose-500/10 text-rose-400'}`}>
                    {pct(it.change)}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
