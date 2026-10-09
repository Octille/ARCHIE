import { isSolanaAddress } from '../shared/solanaAddress.js';
const RPC_URL = process.env.SOLANA_RPC_URL || '';
const RPC_FALLBACK_URL = process.env.SOLANA_RPC_FALLBACK_URL || 'https://solana-rpc.publicnode.com';
const RPC_URLS = [...new Set([RPC_URL, RPC_FALLBACK_URL].filter(Boolean))];
const HOLDER_CACHE_MS = 90_000;
const HOLDER_STALE_MS = 15 * 60_000;
const holderCache = new Map();
const holderInflight = new Map();
const endpointBackoff = new Map();
let requestId = 0;

export { isSolanaAddress };

async function rpc(method, params) {
  if (!RPC_URLS.length) throw new Error('Solana RPC is not configured');
  const failures = [];
  const now = Date.now();
  const availableEndpoints = RPC_URLS.filter((endpoint) => (endpointBackoff.get(endpoint) || 0) <= now);
  if (!availableEndpoints.length) throw new Error('Solana RPC endpoints are in cooldown after rate limits or timeouts');

  for (const endpoint of availableEndpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++requestId, method, params }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) {
        const retryAfter = Number(response.headers.get('retry-after'));
        const cooldown = response.status === 403 ? 15 * 60_000
          : response.status === 429 ? (Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 5 * 60_000) : 60_000)
            : response.status >= 500 ? 20_000 : 0;
        if (cooldown) endpointBackoff.set(endpoint, Date.now() + cooldown);
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      if (payload.error) {
        const message = payload.error.message || 'JSON-RPC request failed';
        if (/rate.?limit|too many requests/i.test(message)) endpointBackoff.set(endpoint, Date.now() + 60_000);
        throw new Error(message);
      }
      endpointBackoff.delete(endpoint);
      return payload.result;
    } catch (error) {
      // Public RPCs can rate-limit or disable indexed methods; try the backup
      // endpoint before treating the holder snapshot as unavailable.
      if (!endpointBackoff.has(endpoint) || endpointBackoff.get(endpoint) <= Date.now()) {
        endpointBackoff.set(endpoint, Date.now() + 30_000);
      }
      let host = 'RPC endpoint';
      try { host = new URL(endpoint).hostname; } catch {}
      failures.push(`${host}: ${error.message}`);
    }
  }
  throw new Error(`All Solana RPC endpoints failed: ${failures.join('; ')}`);
}

const tokenAmount = (info) => {
  const token = info?.tokenAmount || {};
  const raw = token.amount || '0';
  const decimals = Number(token.decimals) || 0;
  return { raw, decimals };
};

export async function getTopReportedHolders(mint) {
  if (!RPC_URL) return { available: false, configured: false, holders: [], sampleSize: 0, partial: true };
  const cached = holderCache.get(mint);
  if (cached && Date.now() - cached.at < HOLDER_CACHE_MS) return cached.value;
  if (holderInflight.has(mint)) return holderInflight.get(mint);

  const pending = (async () => {
    try {
      const largest = await rpc('getTokenLargestAccounts', [mint, { commitment: 'confirmed' }]);
      const accounts = largest?.value || [];
      const keys = accounts.map((item) => item.address).filter(Boolean);
      const owners = keys.length
        ? await rpc('getMultipleAccounts', [keys, { encoding: 'jsonParsed', commitment: 'confirmed' }])
        : { value: [] };
      const grouped = new Map();
      for (let index = 0; index < keys.length; index++) {
        const account = owners?.value?.[index];
        const info = account?.data?.parsed?.info;
        const owner = info?.owner;
        if (!owner) continue;
        const amount = tokenAmount(info);
        const current = grouped.get(owner) || { owner, raw: 0n, decimals: amount.decimals };
        try { current.raw += BigInt(amount.raw); } catch {}
        grouped.set(owner, current);
      }
      const holders = [...grouped.values()]
        .map((holder) => ({
          wallet: holder.owner,
          amount: Number(holder.raw) / (10 ** holder.decimals),
          rawAmount: holder.raw.toString(),
          decimals: holder.decimals,
        }))
        .filter((holder) => holder.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10)
        .map((holder, index) => ({ ...holder, rank: index + 1, title: index === 0 ? 'CHIEF WARDEN' : index < 10 ? 'WARDEN' : 'INMATE' }));
      const value = {
        available: true,
        configured: true,
        holders,
        sampleSize: accounts.length,
        partial: true,
        source: 'Solana RPC getTokenLargestAccounts',
        fetchedAt: Date.now(),
      };
      holderCache.set(mint, { at: Date.now(), value });
      return value;
    } catch (error) {
      const previous = holderCache.get(mint);
      if (previous && Date.now() - previous.at < HOLDER_STALE_MS) return { ...previous.value, stale: true };
      throw error;
    } finally {
      holderInflight.delete(mint);
    }
  })();
  holderInflight.set(mint, pending);
  return pending;
}

export async function lookupWallet(wallet, mint) {
  if (!RPC_URL) throw new Error('Solana RPC is not configured');
  const result = await rpc('getTokenAccountsByOwner', [wallet, { mint }, { encoding: 'jsonParsed', commitment: 'confirmed' }]);
  const balances = (result?.value || []).map(({ account }) => tokenAmount(account?.data?.parsed?.info));
  const decimals = balances[0]?.decimals || 0;
  const rawAmount = balances.reduce((sum, amount) => {
    try { return sum + BigInt(amount.raw); } catch { return sum; }
  }, 0n);
  const amount = Number(rawAmount) / (10 ** decimals);
  let leaderboard = { holders: [], available: false };
  try { leaderboard = await getTopReportedHolders(mint); } catch {}
  const listed = leaderboard.holders.find((holder) => holder.wallet === wallet);
  return {
    wallet,
    mint,
    verified: true,
    hasBalance: rawAmount > 0n,
    amount,
    rawAmount: rawAmount.toString(),
    decimals,
    rank: listed?.rank ?? null,
    title: !amount ? 'VISITOR' : listed?.title || 'INMATE',
    leaderboardPosition: listed?.rank ?? null,
    leaderboardAvailable: Boolean(leaderboard.available),
    holdDuration: null,
    holdDurationAvailable: false,
    fetchedAt: Date.now(),
    leaderboardPartial: true,
  };
}
