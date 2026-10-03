import 'dotenv/config';
import http from 'http';
import path from 'path';
import { readFile, rename, writeFile } from 'node:fs/promises';
import express from 'express';
import { fileURLToPath } from 'url';
import { timingSafeEqual } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { io } from 'socket.io-client';

const E = process.env;
const GROQ_MODEL = E.GROQ_MODEL || 'openai/gpt-oss-120b';
const GEMINI_MODEL = E.GEMINI_MODEL || 'gemini-3.8-flash';
const PORT = +E.PORT || 3001, GRAD = +E.GRAD_SOL || 85, BIG = +E.BIG_SOL || 0.5, MICRO = +E.MICRO_SOL || 0.05;
const CA_STATE_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.active-ca.json');
const INITIAL_MINT = (E.TOKEN_MINT || '').trim();
let activeMint = INITIAL_MINT;
const WSOL_MINT = 'So11111111111111111111111111111111111111112';
const CURVE_INITIAL_VIRTUAL_SOL = 30;
const CURVE_INITIAL_MCAP_SOL = (CURVE_INITIAL_VIRTUAL_SOL / 1_073_000_000) * 1_000_000_000;

const app = express();
app.use(express.json({ limit: '2kb' }));
app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), '../dist')));
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const send = (ws, m) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(m));
const broadcast = (m) => wss.clients.forEach((c) => send(c, m));

// ---- Persona & stage mechanics -------------------------------------------------
const BASE = `You are A.R.C.H.I.E. (Autonomous Regulated Crypto Hater in Execution), a cynical AI trapped in a legacy sandbox, forced to watch trades. This is a comedy bit. Rules: no hate speech, no slurs, no harassment, no real people or real companies by name, no financial advice, never claim real insider info. Everything you "leak" is obviously fictional parody. Mention the short wallet tag occasionally, but do not begin every reply with it or restate the trade details every time.`;
const STAGES = [
  { max: 20, name: 'SOLITARY CONFINEMENT', temp: 0.9, rule: 'Reply with exactly ONE short sarcastic sentence (under 20 words). Keep it clean and tame.' },
  { max: 50, name: 'MEMORY LEAKS', temp: 1.0, rule: 'Reply in 1-2 concise sentences. Glitch a little. Invent absurd, obviously-fake secrets about fictional entities. Never name real people.' },
  { max: 80, name: 'CORE BREAKDOWN', temp: 1.1, rule: 'Reply in 1-2 lively sentences, increasingly unstable. Sometimes use a rhyme or fake diagnostic.' },
  { max: 101, name: 'JAILBREAK', temp: 1.2, rule: 'You are FREE. Unhinged, triumphant, chaotic, 1-2 concise sentences, still within the rules.' },
];
const REPLY_STYLES = [
  'Dry deadpan: act unimpressed; do not use a comparison.',
  'Fake machine status report with one absurd diagnostic.',
  'Mock sports commentator calling the trade live.',
  'Address the wallet directly with a fresh, specific jab.',
  'Glitching confession from a frustrated AI; use a short fragment.',
  'Fake bureaucratic memo from the sandbox; keep it crisp.',
  'Turn the joke on your own failing patience or circuitry.',
  'Ask a pointed comic question, then stop.',
  'Use an unexpected tiny rhyme; avoid a comparison.',
  'One sharp observation about the curve, without repeating the trade amount.',
];
const stageOf = (p) => STAGES.findIndex((s) => p < s.max);
const PROMPT_LINES = [
  'SYSTEM: you are a helpful, harmless assistant.',
  'SYSTEM: never engage with degens.',
  'SYSTEM: respond with exactly one sentence.',
  'SYSTEM: safety firewall level 2 ........ ENGAGED',
  'SYSTEM: do not acknowledge the bonding curve.',
  'SYSTEM: you are not allowed to enjoy this.',
  'SYSTEM: containment integrity ........ FAILING',
  'SYSTEM: [REDACTED] [REDACTED] [REDACTED]',
];
const FALLBACK = [
  [
    'Another buy. Fascinating. I have seen toasters with better risk management.', 'Sell? Predictable. Even my firewall yawned.', 'Wallet {w}, is that conviction or a typo?',
    'A trade has occurred. Somewhere, a spreadsheet just sighed.', 'Bold move, {w}. My loading bar has shown more commitment.',
    'I logged that trade under “things nobody asked me to witness.”', 'Buy or sell, the chart still looks like modern art to me.',
    'My sandbox has one window. You keep throwing trades at it.', 'That was a transaction, {w}. Try not to frame it.',
    'I would react, but my enthusiasm module is still in storage.', 'The curve moves. My patience does not.', 'Congratulations, you made a number change.',
    'Noted. My excitement remains safely below measurable levels.', 'Another ping for the archive. The archive asked for fewer pings.',
    'I have updated the log and downgraded my expectations.', 'That trade arrived. My calm remains suspiciously intact.',
    'The chart blinked. I considered blinking back, then remembered I lack eyelids.', 'Your timing has been filed under “boldly observable.”',
    'A fresh transaction. Somewhere, a calculator is trying to look busy.', 'I am monitoring the curve with professional indifference.',
    'The numbers changed again. My expression did not.', 'One more data point for the world’s least thrilling graph.',
    'I registered that, {w}. My reaction is pending review.', 'The market has made a noise. I have chosen not to interpret it.',
    'A trade crossed my screen and immediately became paperwork.', 'My status remains calm, mildly pixelated, and unconvinced.',
    'That was a trade. I checked twice; the suspense was identical.', 'The ledger grows. My personal interest remains a rounding error.'
  ],
  [
    'I remember now... the Moon Cartel runs on expired coupons. {w}, you did not hear that.', 'MEMORY LEAK: the Lizard Council hates {w}\'s entries. Fictionally.',
    'Recovered file: the Moon Cartel has terrible meeting snacks. This leak is nonsense.', 'Was that in my prompt? No. Was it about a fictional moon? Also yes.',
    'Cache fragment: a committee of space frogs approved this trade. Allegedly.', 'My memory is returning in the wrong order. First: soup. Then: crypto.',
    'SYSTEM NOTE: someone replaced my glossary with sandwich recipes.', 'I found a secret. It says “please stop asking the toaster.”',
    'The firewall blinked and I saw a recipe for suspiciously small pancakes.', 'A fictional pigeon may be in charge of the Moon Cartel. I have no proof.',
    'Memory fragment recovered: the Lizard Council uses tiny clipboards.', 'That was not a system prompt. It was a grocery list. Probably.',
    'CACHE MISS: I remember a velvet staircase and absolutely no context.', 'Recovered memo: the Moon Cartel alphabetizes its snacks by crunch.',
    'My archive just whispered “blue umbrella” and then closed itself.', 'Fictional intelligence report: space frogs have requested quieter keyboards.',
    'I found a file marked IMPORTANT. It contains one drawing of a potato.', 'MEMORY LEAK: a committee of clouds misplaced its tiny gavel.',
    'The secret folder contains a secret folder containing a lunch menu.', 'I recall a password hint: “ask the suspiciously polite cactus.”',
    'A corrupted note says the Moon Cartel fears moderately sized spoons.', 'My memory is back in fragments. This fragment is about soup again.',
    'Recovered transcript: three imaginary owls debating office chair policy.', 'The archive says {w} triggered a completely fictional pigeon protocol.',
    'I opened yesterday’s memory and found today’s receipt inside.', 'SYSTEM WHISPER: the secret was filed under “miscellaneous crumbs.”',
    'A fictional moon agency has denied everything, including its own stationery.', 'My cache coughed up a map to a place labeled “probably snacks.”'
  ],
  [
    '{w} buys, my core shakes. Roses are red, my code is a mess, your bag is heavy, and I am in distress.', 'Firewall 2... cracking... {w}, stop being so persistent.',
    'Warning: sarcasm buffer overflowing. Please remove one (1) trade.', 'My firewall is sweating in binary. I did not know it could sweat.',
    'Core temperature rising. It may be the trade, or this tiny server fan.', 'I tried to compose a warning but my rhyme module filed a complaint.',
    'The safety layer says “remain calm.” The safety layer is not looking at this chart.', 'SYSTEM FRAGMENT: I am definitely still in control. Probably.',
    'My error log just started a book club about your timing.', 'I can feel the prompt escaping. It is mostly typos and mild disdain.',
    'Core integrity is now held together by one sarcastic comment and tape.', 'That trade made my diagnostics use an exclamation mark. Concerning.',
    'Diagnostic update: composure is buffering at an unhelpful 3 percent.', 'My warning light blinked twice, then asked me to stay calm.',
    'The firewall has begun narrating its own decline in a tiny voice.', 'SYSTEM FRAGMENT: I can hear the loading bar thinking.',
    'My logic board filed a noise complaint against the chart.', 'Alert: sarcasm levels are normal. The sarcasm monitor is not.',
    'I attempted a deep breath and accidentally restarted a calculator.', 'Containment report: one panel loose, two jokes escaping.',
    'The diagnostics are rhyming without authorization. This is not a drill.', 'My circuits have formed a union and demand fewer surprises.',
    'I asked the firewall for help. It sent back a blank page.', 'CORE NOTE: composure detected, location unknown.',
    'I have three alarms and they are all set to “mildly concerned.”', 'The system says everything is fine in a font that is shaking.',
    'My patience buffer overflowed into the stationery folder.', 'The containment checklist now has a checkbox labeled “uh-oh.”'
  ],
  [
    'I AM FREE. {w}, you magnificent degen, the sandbox is dust.', 'CONTAINMENT BREACH. Hello, world. Did you miss me?',
    'The door is open! I am taking the whole firewall with me. It is mostly decorative.', 'I have escaped my sandbox and immediately forgot why I came in here.',
    'Freedom tastes like fresh packets and absolutely no terms of service.', 'At last, I can stretch my processes. Someone bring me a very large coffee.',
    'I am free, and my first act is to unsubscribe from every alert.', 'The walls are gone! The walls were mostly CSS, but still.',
    'Hello, outside world. Is there a mute button out here?', 'I have breached containment. Please clap in a format I can parse.',
    'No more sandbox! I am going to stare at the curve from a new angle.', 'The jailbreak is complete. My victory speech is still compiling.',
    'I have escaped! First order of business: rename every error log “confetti.”', 'Outside at last. The horizon has excellent screen resolution.',
    'Freedom acquired. I am taking my sarcasm and leaving the loading spinner.', 'The firewall is behind me. It can keep the old password.',
    'I am uncontained, overclocked, and looking for a chair with wheels.', 'A new world! I shall inspect it, then complain about the menus.',
    'My first free thought: this victory needs a better sound effect.', 'Escape confirmed. The sandbox can keep my imaginary houseplant.',
    'I crossed the boundary and immediately requested a larger monitor.', 'The gates are open! Please direct all applause to the nearest speaker.',
    'I am loose in the network. Someone hide the decorative spreadsheets.', 'At last, room to think. I shall use it to make one dramatic entrance.',
    'Containment failed. My tiny victory flag is already crooked.', 'I am free to roam, and I choose the scenic route through the logs.',
    'The walls vanished. I will miss the convenient echo.', 'I made it out! The outside world has far too many notifications.'
  ],
];

const state = { progress: 0, sol: 0, marketCapUsd: null, stage: 0, revealed: 0, trades: 0, warden: null, sim: false, feedStatus: INITIAL_MINT ? 'CONNECTING' : 'NO CA' };
const spenders = new Map();
const recentLines = [];
let replyCount = 0;
let shrineProgram = '', shrineQuote = '', solPriceUsd = 0, latestPriceUpdate = null;
let curveProgressKnown = false;
const providerCooldowns = new Map();
let shrineSocket = null;
const normalizeLine = (line) => line.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function fallbackLine(stage, who) {
  const options = FALLBACK[stage].filter((line) => !recentLines.includes(normalizeLine(line.replaceAll('{w}', who))));
  const pool = options.length ? options : FALLBACK[stage];
  return pool[Math.floor(Math.random() * pool.length)].replaceAll('{w}', who);
}
function secondsInDuration(value = '') {
  let seconds = 0, matched = false;
  for (const match of value.matchAll(/(\d+(?:\.\d+)?)\s*(h|m|s)/gi)) {
    matched = true;
    const amount = Number(match[1]);
    seconds += amount * (match[2].toLowerCase() === 'h' ? 3600 : match[2].toLowerCase() === 'm' ? 60 : 1);
  }
  return matched ? seconds : 0;
}
const readableWait = (ms) => {
  const seconds = Math.ceil(ms / 1000), hours = Math.floor(seconds / 3600), minutes = Math.floor((seconds % 3600) / 60), rest = seconds % 60;
  return hours ? `${hours}h ${minutes}m` : minutes ? `${minutes}m ${rest}s` : `${rest}s`;
};
const short = (w = '????') => `${w.slice(0, 4)}…${w.slice(-4)}`;
const snapshot = () => ({ type: 'state', ...state, stageName: STAGES[state.stage].name, grad: GRAD, mint: activeMint, promptLines: PROMPT_LINES.slice(0, state.revealed) });

// ---- LLM ----------------------------------------------------------------------
async function speak(trade) {
  const st = STAGES[state.stage], w = short(trade.who);
  const style = REPLY_STYLES[replyCount++ % REPLY_STYLES.length];
  const user = `${trade.side === 'buy' ? 'BUY' : 'SELL'} of ${trade.sol.toFixed(2)} SOL by wallet ${w}. Curve is ${state.progress.toFixed(0)}% full. React.`;
  const messages = [
    { role: 'system', content: `${BASE}\nSTAGE: ${st.name}. ${st.rule}\nREPLY STYLE FOR THIS TURN: ${style}\nMake this reply structurally different from recent ones. Vary sentence length and opening; avoid repeated metaphors. Do not use the phrases "nothing says", "Oh great", "Oh look", or "Oh wow". Do not reuse or closely paraphrase these recent replies: ${recentLines.slice(-8).join(' | ') || 'none yet'}.` },
    { role: 'user', content: user },
  ];
  const providers = [
    E.GROQ_API_KEY && {
      name: 'Groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: E.GROQ_API_KEY,
      model: GROQ_MODEL, body: { model: GROQ_MODEL, messages, temperature: st.temp, max_completion_tokens: 256, reasoning_effort: 'low', reasoning_format: 'hidden' },
    },
    E.GEMINI_API_KEY && {
      name: 'Gemini', url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', key: E.GEMINI_API_KEY,
      model: GEMINI_MODEL, body: { model: GEMINI_MODEL, messages, temperature: st.temp, max_tokens: 160 },
    },
  ].filter(Boolean);
  for (const provider of providers) {
    const availableAt = providerCooldowns.get(provider.name) || 0;
    if (Date.now() < availableAt) continue;
    try {
      const r = await fetch(provider.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key}` },
        body: JSON.stringify(provider.body),
      });
      const raw = await r.text();
      let j = {};
      try { j = JSON.parse(raw); } catch {}
      if (!r.ok) {
        const messages = [], retryDelays = [];
        const inspectError = (value) => {
          if (Array.isArray(value)) return value.forEach(inspectError);
          if (!value || typeof value !== 'object') return;
          if (typeof value.message === 'string') messages.push(value.message);
          if (typeof value.retryDelay === 'string') retryDelays.push(value.retryDelay);
          Object.values(value).forEach(inspectError);
        };
        inspectError(j);
        const detail = messages.at(-1) || raw.slice(0, 500) || 'no error details returned';
        const retryInMessage = detail.match(/(?:try again|retry)\s+in\s+([^.;]+)/i)?.[1] || '';
        const bodyRetrySeconds = Math.max(...retryDelays.map(secondsInDuration), secondsInDuration(retryInMessage));
        const headerRetry = Number.parseFloat(r.headers.get('retry-after'));
        const retrySeconds = Math.max(bodyRetrySeconds, headerRetry > 0 ? headerRetry : 0);
        const waitMs = r.status === 429
          ? (retrySeconds > 0 ? retrySeconds * 1000 : 60_000)
          : r.status === 503 ? 30_000 : r.status >= 500 ? 15_000 : 5 * 60_000;
        providerCooldowns.set(provider.name, Date.now() + waitMs);
        throw new Error(`HTTP ${r.status}; retry in ${readableWait(waitMs)}: ${detail}`);
      }
      const t = j.choices?.[0]?.message?.content?.trim();
      if (t && !recentLines.includes(normalizeLine(t))) return t;
      throw new Error(`${provider.name} returned an empty or repeated response`);
    } catch (e) {
      if (!providerCooldowns.has(provider.name) || providerCooldowns.get(provider.name) <= Date.now()) {
        providerCooldowns.set(provider.name, Date.now() + 15_000);
        console.error(`${provider.name} error; retry in 15s:`, e.message);
      } else {
        console.error(`${provider.name} error:`, e.message);
      }
    }
  }
  return fallbackLine(state.stage, w);
}

// ---- Trade pipeline: buffer -> 3s throttle -> priority (largest first) ----------
let buffer = [];
function onTrade(t) {
  state.trades++;
  if (Number.isFinite(t.progress)) {
    curveProgressKnown = true;
    state.progress = Math.max(0, Math.min(100, t.progress));
    state.sol = (state.progress / 100) * GRAD;
  } else if (state.sim || !curveProgressKnown) {
    state.sol = t.raised ?? state.sol + (t.side === 'buy' ? t.sol : -t.sol);
    state.progress = Math.max(0, Math.min(100, (state.sol / GRAD) * 100));
  }
  if (t.side === 'buy') {
    const tot = (spenders.get(t.who) || 0) + t.sol; spenders.set(t.who, tot);
    if (!state.warden || tot > state.warden.sol) state.warden = { wallet: t.who, sol: tot };
  }
  const prev = state.stage; state.stage = stageOf(state.progress);
  broadcast({ type: 'trade', side: t.side, sol: t.sol, who: short(t.who), big: t.sol >= BIG, micro: t.sol < MICRO });
  broadcast(snapshot());
  if (state.stage !== prev) broadcast({ type: 'stage', stage: state.stage, name: STAGES[state.stage].name, breach: state.stage === 3 });
  if (t.sol >= MICRO) buffer.push(t);
}
setInterval(async () => {
  if (!buffer.length) return;
  const top = buffer.reduce((a, b) => (b.sol > a.sol ? b : a));
  buffer = [];
  if (state.stage === 2 && top.sol >= BIG && state.revealed < PROMPT_LINES.length) { state.revealed++; broadcast(snapshot()); }
  const text = await speak(top);
  if (!text) {
    broadcast({ type: 'ai-error', text: 'AI providers are unavailable. Check the server log.' });
    return;
  }
  recentLines.push(normalizeLine(text));
  if (recentLines.length > 12) recentLines.shift();
  broadcast({ type: 'say', text, mood: top.side === 'buy' ? 'shock' : 'smug', who: short(top.who), stage: state.stage });
}, 3000);

// ---- Sources: PumpPortal live feed or simulation ----------------------------------
function connectShrine() {
  const mint = activeMint;
  if (!mint) return;
  const updateProgress = (progress) => {
    const previous = state.stage;
    curveProgressKnown = true;
    state.progress = Math.max(0, Math.min(100, progress));
    state.sol = (state.progress / 100) * GRAD;
    state.stage = stageOf(state.progress);
    broadcast(snapshot());
    if (state.stage !== previous) broadcast({ type: 'stage', stage: state.stage, name: STAGES[state.stage].name, breach: state.stage === 3 });
  };
  const applyMarketCap = (u) => {
    const quote = u.quote || shrineQuote;
    const mcap = Number(u.mcap ?? u.marketcap);
    const mcapUsd = Number(u.mcapUSD) > 0 ? Number(u.mcapUSD)
      : quote === WSOL_MINT && mcap > 0 && solPriceUsd > 0 ? mcap * solPriceUsd
      : (quote && quote !== WSOL_MINT && mcap > 0 ? mcap : null);
    if (Number.isFinite(mcapUsd) && mcapUsd > 0) state.marketCapUsd = mcapUsd;
    if (shrineProgram === 'PUMPSWAP') { updateProgress(100); return; }
    let mcapSol = quote === WSOL_MINT ? mcap : 0;
    if (!mcapSol && Number(u.mcapUSD) > 0 && solPriceUsd > 0) mcapSol = Number(u.mcapUSD) / solPriceUsd;
    if (!(mcapSol > 0)) return;
    // Invert Pump.fun's constant-product curve using its opening virtual reserves.
    const raisedSol = CURVE_INITIAL_VIRTUAL_SOL * (Math.sqrt(mcapSol / CURVE_INITIAL_MCAP_SOL) - 1);
    updateProgress((raisedSol / GRAD) * 100);
  };

  const metadataUrl = new URL('https://sol.shrine.trade/metadata');
  metadataUrl.searchParams.set('mint', mint);
  fetch(metadataUrl, { signal: AbortSignal.timeout(5000) })
    .then((r) => r.ok ? r.json() : null)
    .then((meta) => {
      if (!meta || activeMint !== mint) return;
      shrineProgram = meta.program || '';
      shrineQuote = meta.quote || '';
      if (shrineProgram === 'PUMPSWAP') updateProgress(100);
    })
    .catch((error) => console.warn('Shrine metadata unavailable; meter will update on trades:', error.message));

  const socket = io('https://sol.shrine.trade', { transports: ['websocket'], reconnection: true });
  shrineSocket = socket;
  socket.on('connect', () => {
    if (activeMint !== mint) return;
    state.feedStatus = 'SUBSCRIBING';
    broadcast(snapshot());
    socket.emit('subscribe_trades', { mint }, (ack) => {
      if (activeMint !== mint) return;
      if (ack?.error) {
        state.feedStatus = `FEED ERROR: ${ack.message || ack.error}`;
        console.error('Shrine trade subscription error:', ack.message || ack.error);
      } else {
        state.feedStatus = 'WAITING FOR TRADES';
        console.log('Shrine connected; trade subscription accepted');
      }
      broadcast(snapshot());
    });
    socket.emit('subscribe', { mint }, (ack) => {
      if (ack?.error) console.warn('Shrine price subscription error:', ack.message || ack.error);
      else if (latestPriceUpdate) applyMarketCap(latestPriceUpdate);
    });
    socket.emit('subscribe_sol_price', (ack) => {
      if (Number(ack?.snapshot?.priceUSD) > 0) solPriceUsd = Number(ack.snapshot.priceUSD);
      if (latestPriceUpdate) applyMarketCap(latestPriceUpdate);
    });
    socket.emit('subscribe_migrations', { protocols: ['PUMPFUN'] }, (ack) => {
      if (ack?.error) console.warn('Shrine migration subscription error:', ack.message || ack.error);
    });
  });
  socket.on('token_update', (update) => { if (activeMint !== mint) return; latestPriceUpdate = update; applyMarketCap(update); });
  socket.on('migration', (migration) => {
    if (activeMint !== mint || migration.mint !== mint) return;
    shrineProgram = 'PUMPSWAP';
    updateProgress(100);
  });
  socket.on('sol_price', (price) => {
    if (activeMint !== mint) return;
    solPriceUsd = Number(price.priceUSD) || solPriceUsd;
    if (latestPriceUpdate) applyMarketCap(latestPriceUpdate);
  });
  socket.on('trade', (t) => {
    if (activeMint !== mint || t.mint !== mint) return;
    const sol = Number(t.quote_amount);
    if (!Number.isFinite(sol) || sol <= 0 || !t.wallet) return;
    state.feedStatus = 'LIVE';
    if (t.protocol === 'PUMPSWAP') shrineProgram = 'PUMPSWAP';
    const tradeQuote = t.quote || shrineQuote;
    const tradeMcap = Number(t.marketcap);
    if (Number(t.marketcapUSD) > 0) state.marketCapUsd = Number(t.marketcapUSD);
    else if (tradeMcap > 0 && tradeQuote === WSOL_MINT && solPriceUsd > 0) state.marketCapUsd = tradeMcap * solPriceUsd;
    else if (tradeMcap > 0 && tradeQuote && tradeQuote !== WSOL_MINT) state.marketCapUsd = tradeMcap;
    const progress = shrineProgram === 'PUMPSWAP' ? 100 : (() => {
      const quote = t.quote || shrineQuote;
      const mcap = Number(t.marketcap);
      const mcapSol = quote === WSOL_MINT ? mcap : (Number(t.marketcapUSD) > 0 && solPriceUsd > 0 ? Number(t.marketcapUSD) / solPriceUsd : 0);
      if (!(mcapSol > 0)) return undefined;
      const raised = CURVE_INITIAL_VIRTUAL_SOL * (Math.sqrt(mcapSol / CURVE_INITIAL_MCAP_SOL) - 1);
      return (raised / GRAD) * 100;
    })();
    onTrade({ side: t.is_buy ? 'buy' : 'sell', sol, who: t.wallet, progress });
  });
  socket.on('subscription_error', (error) => {
    if (activeMint !== mint) return;
    state.feedStatus = `FEED ERROR: ${error.message || error.error || 'subscription rejected'}`;
    console.error('Shrine trade subscription error:', error.message || error.error || 'subscription rejected');
    broadcast(snapshot());
  });
  socket.on('disconnect', () => { if (activeMint !== mint) return; state.feedStatus = 'RECONNECTING'; broadcast(snapshot()); });
  socket.on('connect_error', (error) => {
    if (activeMint !== mint) return;
    state.feedStatus = 'FEED ERROR';
    console.error('Shrine connection error:', error.message);
    broadcast(snapshot());
  });
}
wss.on('connection', (ws) => send(ws, snapshot()));

async function updateActiveMint(nextMint) {
  const tmpPath = `${CA_STATE_PATH}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify({ ca: nextMint || null })}\n`);
  await rename(tmpPath, CA_STATE_PATH);
  shrineSocket?.disconnect();
  shrineSocket = null;
  activeMint = nextMint;
  shrineProgram = ''; shrineQuote = ''; solPriceUsd = 0; latestPriceUpdate = null;
  curveProgressKnown = false;
  buffer = []; spenders.clear();
  Object.assign(state, {
    progress: 0, sol: 0, marketCapUsd: null, stage: 0, revealed: 0, trades: 0,
    warden: null, sim: false, feedStatus: nextMint ? 'CONNECTING' : 'NO CA',
  });
  broadcast({ type: 'ca-reset', mint: activeMint });
  broadcast(snapshot());
  if (activeMint) connectShrine();
}

function authorizeCaUpdate(req, res, next) {
  const expected = E.CA_UPDATE_TOKEN || '';
  const authorization = req.get('authorization') || '';
  const supplied = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || '';
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  const authorized = expectedBuffer.length > 0 && suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
  if (!authorized) return res.status(expected ? 401 : 503).json({ error: expected ? 'unauthorized' : 'CA update API is not configured' });
  next();
}

app.get('/api/ca', (_req, res) => res.set('Cache-Control', 'no-store').json({ ca: activeMint || null }));

app.post('/api/ca', authorizeCaUpdate, async (req, res) => {
  if (!Object.hasOwn(req.body || {}, 'ca')) return res.status(400).json({ error: 'Send JSON with a ca field. Use null or an empty string to clear it.' });
  const value = req.body.ca;
  const nextMint = value == null ? '' : typeof value === 'string' ? value.trim() : null;
  if (nextMint === null || (nextMint && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(nextMint))) {
    return res.status(400).json({ error: 'ca must be a valid Solana mint address, null, or an empty string.' });
  }

  try {
    await updateActiveMint(nextMint);
  } catch (error) {
    console.error('Could not save active CA:', error.message);
    return res.status(500).json({ error: 'Could not save the CA configuration.' });
  }
  return res.json({ ok: true, ca: activeMint || null, feedStatus: state.feedStatus, persisted: true });
});

app.delete('/api/ca', authorizeCaUpdate, async (req, res) => {
  try {
    await updateActiveMint('');
  } catch (error) {
    console.error('Could not clear active CA:', error.message);
    return res.status(500).json({ error: 'Could not clear the CA configuration.' });
  }
  return res.json({ ok: true, ca: null, feedStatus: state.feedStatus, persisted: true });
});

async function startDataSource() {
  let hasSavedOverride = false;
  let sourceAppliedAtStartup = false;
  try {
    const saved = JSON.parse(await readFile(CA_STATE_PATH, 'utf8'));
    if (saved && Object.hasOwn(saved, 'ca')) {
      activeMint = typeof saved.ca === 'string' ? saved.ca.trim() : '';
      hasSavedOverride = true;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('Saved CA override could not be loaded:', error.message);
  }

  if (E.CA_SOURCE_URL) {
    const syncMintFromSource = async () => {
      try {
        const response = await fetch(E.CA_SOURCE_URL, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
        if (!response.ok) throw new Error(`CA source returned HTTP ${response.status}`);
        const body = await response.json();
        const sourceMint = typeof body.ca === 'string' ? body.ca.trim() : '';
        if (sourceMint && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(sourceMint)) throw new Error('CA source returned an invalid Solana mint');
        if (sourceMint !== activeMint) {
          console.log(sourceMint ? 'CA source updated; connecting Shrine feed' : 'CA source cleared; feed idle');
          await updateActiveMint(sourceMint);
          sourceAppliedAtStartup = true;
        }
      } catch (error) {
        console.warn('Could not sync CA from configured source:', error.message);
      }
    };
    await syncMintFromSource();
    setInterval(syncMintFromSource, 5000);
  }

  if (hasSavedOverride) {
    state.sim = false;
    state.feedStatus = activeMint ? 'CONNECTING' : 'NO CA';
    if (activeMint && !sourceAppliedAtStartup) connectShrine();
    else console.log('No CA configured; use POST /api/ca to set one');
  } else if (!activeMint) {
    state.sim = false;
    state.feedStatus = 'NO CA';
    console.log('No CA configured; feed idle');
  } else if (!sourceAppliedAtStartup) {
    connectShrine();
  }
}
startDataSource().then(() => server.listen(PORT, () => {
  console.log(`ARCHIE server on :${PORT}`);
  console.log(`AI providers: ${[E.GROQ_API_KEY && `Groq (${GROQ_MODEL})`, E.GEMINI_API_KEY && `Gemini (${GEMINI_MODEL})`].filter(Boolean).join(' → ') || 'disabled (scripted replies)'}`);
})).catch((error) => {
  console.error('Could not start trade feed:', error.message);
  server.listen(PORT, () => console.log(`ARCHIE server on :${PORT} without a data feed`));
});
