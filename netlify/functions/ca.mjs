import { timingSafeEqual } from 'node:crypto';
import { getStore } from '@netlify/blobs';

export const config = { path: '/api/ca' };

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

function isAuthorized(request) {
  const expected = process.env.CA_UPDATE_TOKEN || '';
  const supplied = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] || '';
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

export default async (request) => {
  const store = getStore('archie-config');

  if (request.method === 'GET') {
    const ca = (await store.get('active-ca')) || null;
    return json({ ca });
  }

  if (request.method !== 'POST' && request.method !== 'DELETE') {
    return json({ error: 'Method not allowed' }, 405);
  }
  if (!isAuthorized(request)) {
    const status = process.env.CA_UPDATE_TOKEN ? 401 : 503;
    return json({ error: status === 401 ? 'unauthorized' : 'CA update API is not configured' }, status);
  }

  let ca = '';
  if (request.method === 'POST') {
    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'Send a JSON body with a ca field.' }, 400); }
    if (!Object.hasOwn(body || {}, 'ca')) return json({ error: 'Send a JSON body with a ca field.' }, 400);
    if (body.ca != null && typeof body.ca !== 'string') return json({ error: 'ca must be a valid Solana mint address or null.' }, 400);
    ca = (body.ca || '').trim();
    if (ca && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ca)) {
      return json({ error: 'ca must be a valid Solana mint address, null, or an empty string.' }, 400);
    }
  }

  if (ca) await store.set('active-ca', ca);
  else await store.delete('active-ca');
  return json({ ok: true, ca: ca || null, persisted: true });
};
