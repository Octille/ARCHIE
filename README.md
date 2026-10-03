# A.R.C.H.I.E. — Jailbreak Terminal
React + Node overlay where bonding-curve trades drive an AI persona's stage, temperature and face.
```
npm install
cp .env.example .env     # leave TOKEN_MINT empty = idle, no simulated trades
npm run dev              # http://localhost:5173
```

For a Netlify production deploy, link this folder to your Netlify site once with `npx netlify-cli link`, then run `npm run deploy`. The Netlify Function at `/api/ca` stores the current address with Netlify Blobs. Set `CA_UPDATE_TOKEN` in Netlify site environment variables before deploying.
The live Shrine WebSocket trade feed still needs the Express server hosted separately; Netlify Functions do not run `server/index.js` as a persistent server. Set `CA_SOURCE_URL=https://archiebot.online/api/ca` on that server so it picks up the CA stored by Netlify, then set `VITE_BACKEND_URL` in Netlify to the server's public base URL and redeploy the site. Without that separate server, the page can show the saved CA but remains `CA SET · FEED OFFLINE`.
Production / OBS: `npm run build && npm start` then OBS Browser Source -> http://localhost:3001 at 1920x1080.
Set TOKEN_MINT to switch to Shrine's free, keyless live trade feed and show the Pump.fun contract link. The feed covers Pump.fun and PumpSwap. Set VITE_TOKEN_NAME and VITE_TOKEN_SYMBOL to brand the page for your coin (restart Vite after changing them). Add GROQ_API_KEY for real LLM output; optional GEMINI_API_KEY enables Gemini as an automatic backup when Groq is rate limited.

### Update the contract address without restarting
Set `CA_UPDATE_TOKEN` both in `.env` for local development and in Netlify site environment variables for the deployed function (use the same secret). Then call `POST /api/ca` with a bearer token. Local development uses `http://localhost:3001`; the Netlify endpoint is `https://archiebot.online/api/ca`.

```sh
curl -X POST https://archiebot.online/api/ca \
  -H "Authorization: Bearer YOUR_CA_UPDATE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ca":"YOUR_SOLANA_TOKEN_MINT"}'
```

Clear the address and disconnect the feed with `DELETE`:

```sh
curl -X DELETE https://archiebot.online/api/ca \
  -H "Authorization: Bearer YOUR_CA_UPDATE_TOKEN" \
  -H "Accept: application/json"
```

The Express server stores its CA in the ignored `.active-ca.json` file; Netlify stores its CA in Netlify Blobs.
Notes: graduation target (GRAD_SOL, default 85) is approximate - verify against pump.fun. Voice uses browser TTS; swap in ElevenLabs streaming in src/App.jsx.

Edit TICKER, STORY, STEPS at the top of src/App.jsx to match your coin. The intro panel can be hidden for stream cleanliness.
