import { isSolanaAddress } from '../shared/solanaAddress.js';
const RPC_URL = process.env.SOLANA_RPC_URL || '';
const HOLDER_CACHE_MS = 30_000;
const holderCache = new Map();
let requestId = 0;

export { isSolanaAddress };

async function rpc(method, params) {
  if (!RPC_URL) throw new Error('Solana RPC is not configured');
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++requestId, method, params }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Solana RPC returned HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message || 'Solana RPC request failed');
  return payload.result;
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
  const leaderboard = await getTopReportedHolders(mint);
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
    holdDuration: null,
    holdDurationAvailable: false,
    fetchedAt: Date.now(),
    leaderboardPartial: true,
  };
}
