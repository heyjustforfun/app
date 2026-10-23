// Live crypto prices for the website ticker, cached for 60s so we stay within CoinGecko's free limits.
const IDS = { bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', binancecoin: 'BNB', ripple: 'XRP', cardano: 'ADA' };
let cache = { at: 0, data: [] };

export async function getMarket() {
  if (Date.now() - cache.at < 60_000) return cache.data;
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${Object.keys(IDS).join(',')}&vs_currencies=usd&include_24hr_change=true`;
    const r = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    const data = Object.entries(IDS)
      .filter(([id]) => j[id])
      .map(([id, symbol]) => ({ symbol, price: j[id].usd, change24h: j[id].usd_24h_change ?? null }));
    cache = { at: Date.now(), data };
  } catch {
    // keep serving the previous prices; retry in 60s
    cache.at = Date.now();
  }
  return cache.data;
}
