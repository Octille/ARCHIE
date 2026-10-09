# A.R.C.H.I.E. — Live AI Companion Facility

A code-built React/Vite experience centered on ARCHIE, a stylized 3D mechanical AI companion. The page combines a hand-modeled Three.js character and interactive containment cell with a live Solana token feed, a fictional storyline, community mini-games, and read-only wallet tools.

## Run locally

```sh
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`. Vite serves the UI and proxies `/api` and `/ws` to the Express service on port 3001. Leave `TOKEN_MINT` blank to start in an idle state; the app does not create simulated trades.

`npm run build` creates the static site in `dist/`. `npm start` runs the Express server, which also serves `dist/` when the site has been built.

## Architecture

- **Frontend:** React 18, Vite, Three.js, and React Three Fiber. ARCHIE and the cell are built from code-defined 3D geometry, materials, lights, and animations. Visitors can orbit and zoom the camera; the scene loads after entering the facility to keep the initial page lighter. There is no 2D character fallback.
- **Live transport:** the browser opens a WebSocket at `/ws`. `server/index.js` connects to Shrine's Socket.IO feed, subscribes to Pump.fun trades and migration notices, and broadcasts snapshots, trades, AI reactions, and facility events.
- **Progress and archive:** market-cap updates estimate bonding-curve progress using the configured `GRAD_SOL` target. Progress is capped below 100% until the feed reports PumpSwap migration. Fictional archive files unlock at 25%, 50%, 75%, and 90%; the final story file and escape sequence require verified migration.
- **AI dialogue:** if `GROQ_API_KEY` or `GEMINI_API_KEY` is configured, the backend requests short character reactions. Without provider keys, it uses the built-in scripted dialogue. The character content is fictional parody.
- **Community store:** poll votes, daily riddle answers, prediction points, and graduation times are saved to `.archie-community.json`. The one-per-browser controls use a local browser ID, not a verified identity; these casual features are not secure governance or Sybil-resistant scoring. Prediction points have no monetary value or prize.
- **Milestone store:** unlocked file IDs are saved in `.archie-state.json`, keyed by mint. The event timeline and trade/session warden are held in memory and reset when the active mint changes or the server restarts.
- **Wallet/RPC tools:** `SOLANA_RPC_URL` stays server-side and is never sent to the browser. Holder and wallet reads try it first, then use `SOLANA_RPC_FALLBACK_URL` (default: PublicNode) if it fails. Rate-limited or blocked endpoints enter cooldown to avoid repeated requests. Holder requests are deduplicated and cached; if providers fail after a successful read, the last sample can be served as stale for up to 15 minutes. Public RPCs are shared and can still be rate-limited; use a private provider URL for production traffic.

## Data limits and display rules

- Holder roster calls Solana `getTokenLargestAccounts`, then groups the returned token accounts by owner where parsed account data is available. That RPC method reports at most 20 largest token accounts, so the roster is explicitly partial and can miss holders. See [Solana's RPC reference](https://solana.com/docs/rpc/http/gettokenlargestaccounts).
- Wallet lookup uses `getTokenAccountsByOwner` for the selected mint. It can report a current balance, but current balance is not acquisition history. Hold duration, all-time holder totals, complete rank, previous sell history, and holder-count milestones are shown as unavailable rather than inferred. See [Solana's owner-token-account method](https://solana.com/docs/rpc/http/gettokenaccountsbyowner).
- Market-cap trend becomes meaningful only after five minutes of live samples. It compares the latest value with the closest sample at or before the five-minute cutoff. Values depend on feed metadata and the SOL/USD quote being available.
- “Top buyer this session” is a running sum of observed buys since the mint was selected. It is not an on-chain holder claim.
- The website is entertainment. No content is financial advice. Live data may be delayed or incomplete; token activity is risky.

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `PORT` | Express server | HTTP/WebSocket port; defaults to `3001`. |
| `TOKEN_MINT` | Express server | Initial Solana mint. Blank means no active token feed. |
| `GRAD_SOL` | Express server | Approximate Pump.fun progress target in SOL; defaults to `85`. |
| `BIG_SOL` | Express server | Large-trade emotional reaction threshold; defaults to `0.5`. |
| `MICRO_SOL` | Express server | Minimum trade size queued for AI dialogue; defaults to `0.05`. |
| `SOLANA_RPC_URL` | Express server | Optional primary Solana JSON-RPC endpoint for holder and wallet snapshots. |
| `SOLANA_RPC_FALLBACK_URL` | Express server | Optional fallback endpoint; defaults to `https://solana-rpc.publicnode.com`. |
| `SITE_ORIGIN` | Express server | Allowed browser origin for the Express API/WebSocket deployment; defaults to `*`. Set to the deployed site origin when hosting separately. |
| `CA_UPDATE_TOKEN` | Express server and Netlify function | Bearer secret protecting contract-address updates. Use the same secret in both places if both endpoints are used. |
| `CA_SOURCE_URL` | Express server | Optional JSON endpoint that returns `{ "ca": "..." }`; commonly the static site's `/api/ca` function. |
| `GROQ_API_KEY` | Express server | Optional Groq key for live AI dialogue. |
| `GROQ_MODEL` | Express server | Optional Groq model override. |
| `GEMINI_API_KEY` | Express server | Optional Gemini fallback key. |
| `GEMINI_MODEL` | Express server | Optional Gemini model override. |
| `VITE_BACKEND_URL` | Vite build | Public base URL of the Express service when UI and server have different origins. Leave blank for local Vite proxying. |
| `VITE_TOKEN_NAME` | Vite build | Brand name shown in the UI. |
| `VITE_TOKEN_SYMBOL` | Vite build | Display ticker; defaults to `ARCHIE`. |

Frontend variables are compiled into the public browser bundle. Never put RPC credentials, AI keys, or CA update secrets in a `VITE_` variable.

## Production deployment

The static frontend can be deployed to Netlify; the Netlify Function at `/api/ca` stores the current mint in Netlify Blobs. The Shrine connection, WebSocket, wallet lookup, holder sample, community actions, and local JSON stores require the persistent Express server.

1. Deploy the static site and set `CA_UPDATE_TOKEN` for its Netlify Function.
2. Run `npm run build && npm start` on a persistent Node host with a writable data directory. Keep `.active-ca.json`, `.archie-state.json`, and `.archie-community.json` on persistent storage if those values should survive restarts or redeploys.
3. Set `CA_SOURCE_URL=https://YOUR_SITE/api/ca` on the Express server if Netlify owns the active mint. The server polls the endpoint and follows changes.
4. Set `VITE_BACKEND_URL` to the Express server's public HTTPS URL and set `SITE_ORIGIN` there to the site's origin, then rebuild/redeploy the frontend.
5. Optionally set `SOLANA_RPC_URL` and one or both AI provider keys on the Express server.

For a Netlify deploy, link the repository with `npx netlify-cli link`, then use `npm run deploy`. Netlify's static deployment alone does not run the Express service; without it, the saved CA can appear while live features remain offline.

## Contract address API

Set `CA_UPDATE_TOKEN` on the server, then use a bearer token:

```sh
curl -X POST https://YOUR_BACKEND/api/ca \
  -H "Authorization: Bearer YOUR_CA_UPDATE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ca":"YOUR_SOLANA_TOKEN_MINT"}'
```

Send `{"ca":null}` to clear the address, or call `DELETE /api/ca`. The API checks that a mint decodes to a 32-byte Solana address and stores the active CA in `.active-ca.json`.

## Main endpoints

| Method and path | Description |
| --- | --- |
| `GET /api/ca` | Current mint. On Netlify this is backed by Netlify Blobs. |
| `POST /api/ca`, `DELETE /api/ca` | Set or clear mint; bearer-token protected. |
| `GET /api/holders` | Partial largest-account owner sample; requires `SOLANA_RPC_URL` and an active mint. |
| `GET /api/wallet?address=...` | Current token balance and rank within that partial sample; requires RPC. |
| `GET /api/community` | Poll, daily riddle, and free prediction status. |
| `POST /api/community/vote` | Record one poll vote per browser ID. |
| `POST /api/community/interrogation` | Submit today's riddle response. |
| `POST /api/community/prediction` | Predict migration window for the current mint. |
| `WS /ws` | Live snapshots, trade tape, event history, reactions, and stage changes. |

The screen recorder uses the browser's `getDisplayMedia` picker after a visitor chooses **Record a moment**. Captures are downloaded locally in the browser-supported video format; the site does not upload them. Replay animates a snapshot of recent in-memory milestone/trade events and is not a saved video replay.
