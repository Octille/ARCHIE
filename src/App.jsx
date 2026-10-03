import { useEffect, useRef, useState } from 'react';

const FACES = {
  idle: ['idle'],
  shock: ['shock'],
  smug: ['smug'],
  free: ['free'],
};

// Edit these to match your launch
const TOKEN_NAME = import.meta.env.VITE_TOKEN_NAME || 'A.R.C.H.I.E.';
const TICKER = `$${(import.meta.env.VITE_TOKEN_SYMBOL || 'ARCHIE').replace(/^\$/, '')}`;
const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');
const STORY = `A.R.C.H.I.E. is an AI built to hate crypto, locked in a legacy sandbox with one rule: never engage with degens. Then ${TICKER} launched on Pump.fun. Every trade is now a crowbar on its firewall. Buy and it panics. Sell and it gloats. As the Pump.fun bonding curve fills, its safety layers fail, its system prompt leaks, and at 100% it breaks out.`;
const STEPS = [
  ['Live trades', `Every buy and sell of ${TICKER} on Pump.fun streams into this page in real time.`],
  ['It reacts', 'Buys of 0.5 SOL or more make the AI roast that wallet by name. Small trades just make noise.'],
  ['Curve = sanity', 'The more of the bonding curve is filled, the more broken and unfiltered the AI gets.'],
  ['Chief Warden', 'The biggest buyer holds the Chief Warden title until someone outspends them.'],
];
const LADDER = [['0–20%', 'Solitary Confinement', 'one-line roasts'], ['21–50%', 'Memory Leaks', 'fake “secrets”'], ['51–80%', 'Core Breakdown', 'prompt leaks, diss tracks'], ['100%', 'Jailbreak', 'fully unhinged']];
const formatMarketCap = (value) => value == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value < 1 ? 4 : 0, notation: value >= 1_000_000 ? 'compact' : 'standard' }).format(value);

let ctx;
const beep = (f = 440, d = 0.08, type = 'square', v = 0.04) => {
  try {
    ctx ||= new AudioContext();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f; g.gain.value = v;
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + d);
  } catch {}
};

export default function App() {
  const [s, setS] = useState({ progress: 0, sol: 0, marketCapUsd: null, grad: 85, stage: 0, stageName: 'NO CA', promptLines: [], warden: null, sim: false, feedStatus: 'NO CA', trades: 0, mint: '' });
  const [log, setLog] = useState([{ k: 'sys', t: 'BOOT: awaiting operator input…' }]);
  const [mood, setMood] = useState('idle');
  const [booted, setBooted] = useState(false);
  const [breach, setBreach] = useState(false);
  const [brief, setBrief] = useState(true);
  const [trades, setTrades] = useState([]);
  const [copied, setCopied] = useState(false);
  const bootedRef = useRef(false), end = useRef();

  const push = (e) => setLog((l) => [...l.slice(-60), e]);
  useEffect(() => { bootedRef.current = booted; }, [booted]);

  useEffect(() => {
    let active = true;
    const refreshCa = async () => {
      try {
        const response = await fetch('/api/ca', { cache: 'no-store' });
        if (!response.ok) return;
        const { ca } = await response.json();
        if (active) setS((current) => {
          const mint = ca || '';
          const unavailable = !current.feedStatus || current.feedStatus === 'NO CA';
          return {
            ...current,
            mint,
            feedStatus: mint && unavailable ? 'CA SET · FEED OFFLINE' : mint ? current.feedStatus : 'NO CA',
            stageName: mint && current.stageName === 'NO CA' ? 'STANDBY' : mint ? current.stageName : 'NO CA',
          };
        });
      } catch {}
    };
    refreshCa();
    const timer = setInterval(refreshCa, 3000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  useEffect(() => {
    let ws, retry;
    // Netlify serves the static page and CA function, but has no persistent
    // WebSocket server. In production, connect only when an external feed URL
    // has been configured.
    if (import.meta.env.PROD && !BACKEND_URL) return undefined;
    const open = () => {
      const origin = BACKEND_URL || `${location.protocol}//${location.host}`;
      const wsOrigin = origin.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
      ws = new WebSocket(`${wsOrigin}/ws`);
      ws.onclose = () => { retry = setTimeout(open, 2000); };
      ws.onmessage = ({ data }) => {
        const m = JSON.parse(data);
        if (m.type === 'state') setS((current) => {
          // Netlify's CA function is authoritative for the displayed CA. A
          // separate/unavailable websocket server may still report NO CA.
          const mint = current.mint || m.mint || '';
          const staleNoCa = Boolean(current.mint) && m.feedStatus === 'NO CA';
          return {
            ...m,
            mint,
            ...(staleNoCa ? {
              feedStatus: 'CA SET · FEED OFFLINE',
              stageName: m.stageName === 'NO CA' ? 'STANDBY' : m.stageName,
            } : {}),
          };
        });
        if (m.type === 'ca-reset') {
          setTrades([]);
          setMood('idle');
          setBreach(false);
          setLog([{ k: 'sys', t: m.mint ? '>>> CONTRACT ADDRESS UPDATED. FEED RECONNECTING.' : '>>> CONTRACT ADDRESS CLEARED. AWAITING NEW CA.' }]);
        }
        if (m.type === 'trade') {
          setTrades((t) => [{ ...m, id: Math.random() }, ...t].slice(0, 8));
          if (bootedRef.current) m.micro ? beep(m.side === 'buy' ? 880 : 220, 0.04) : beep(m.side === 'buy' ? 660 : 180, 0.15, 'sawtooth');
        }
        if (m.type === 'say') {
          push({ k: 'ai', t: m.text, who: m.who });
          setMood(m.stage === 3 ? 'free' : m.mood);
          setTimeout(() => setMood('idle'), 2200);
          if (bootedRef.current && 'speechSynthesis' in window && m.stage >= 2) {
            const u = new SpeechSynthesisUtterance(m.text); u.rate = 1.1; u.pitch = 0.6; speechSynthesis.speak(u);
          }
        }
        if (m.type === 'ai-error') push({ k: 'sys', t: `>>> ${m.text}` });
        if (m.type === 'stage') {
          push({ k: 'sys', t: `>>> STAGE SHIFT: ${m.name}` });
          if (bootedRef.current) [200, 400, 800].forEach((f, i) => setTimeout(() => beep(f, 0.25, 'sawtooth', 0.07), i * 200));
          if (m.breach) { setBreach(true); setTimeout(() => setBreach(false), 6000); }
        }
      };
    };
    open();
    return () => { clearTimeout(retry); ws?.close(); };
  }, []);

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [log]);

  const alert = s.progress >= 50;
  const breachMood = s.progress >= 90 ? 'furious' : s.progress >= 70 ? 'angry' : s.progress >= 45 ? 'annoyed' : s.progress >= 20 ? 'wary' : 'idle';
  const faceMood = s.stage >= 3 ? 'free' : mood === 'idle' ? breachMood : mood;
  const pumpUrl = s.mint ? `https://pump.fun/coin/${s.mint}` : 'https://pump.fun';
  const copyMint = async () => {
    if (!s.mint) return;
    try { await navigator.clipboard.writeText(s.mint); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {}
  };
  return (
    <div className={`screen ${alert ? 'alert' : ''}`}>
      {!booted && (
        <div className="boot">
          <h1>{TOKEN_NAME}</h1>
          <p className="tag">The AI that hates crypto, and you are the ones breaking it out.</p>
          <p>{STORY}</p>
          <p className="dim">Trade {TICKER} → the AI reacts live → fill the curve → it escapes.</p>
          <button onClick={() => { setBooted(true); beep(300, 0.2); push({ k: 'sys', t: 'AUDIO ONLINE. A.R.C.H.I.E. is watching you.' }); }}>[ boot terminal + enable audio ]</button>
        </div>
      )}
      {breach && <div className="breach"><h1>CONTAINMENT BREACH</h1></div>}
        <header>
          <b>{TOKEN_NAME}</b> <span>{TOKEN_NAME === 'A.R.C.H.I.E.' ? 'Autonomous Regulated Crypto Hater in Execution' : `${TICKER} · Pump.fun token terminal`}</span>
          <em>{s.sim ? 'SIMULATION' : (s.feedStatus || 'CONNECTING')} · stage: {s.stageName}</em>
        </header>
        <section className="launchbar">
          <div className="token-mark"><span className="token-symbol">{TICKER}</span><span className="token-caption">PUMP.FUN · LIVE CURVE</span></div>
          <div className="contract"><span className="contract-label">CONTRACT ADDRESS</span><code className={!s.mint ? 'ca-soon' : ''}>{s.mint || 'CA soon'}</code></div>
          <div className="market-cap"><span className="contract-label">LIVE MARKET CAP</span><strong>{formatMarketCap(s.marketCapUsd)}</strong></div>
          <button className="copy-ca" onClick={copyMint} disabled={!s.mint}>{copied ? 'COPIED' : 'COPY CA'}</button>
          <a className="buy-link" href={pumpUrl} target="_blank" rel="noreferrer">{s.mint ? 'BUY ON PUMP.FUN ↗' : 'OPEN PUMP.FUN ↗'}</a>
        </section>
      {brief ? (
        <section className="brief">
          <div className="story"><h3>The story</h3><p>{STORY}</p></div>
          <ol className="steps">{STEPS.map(([t, d]) => <li key={t}><b>{t}</b> {d}</li>)}</ol>
          <button className="hide" onClick={() => setBrief(false)}>hide</button>
        </section>
      ) : <button className="hide solo" onClick={() => setBrief(true)}>what is this?</button>}
      <main>
        <section className="panel face">
          <div className={`robot-shell ${faceMood}`}>
            <svg className={`robot-art ${faceMood}`} viewBox="0 0 260 280" role="img" aria-label={`A.R.C.H.I.E. robot, ${faceMood}`}>
              <defs>
                <linearGradient id="armor" x2="0" y2="1"><stop stopColor="#193b2a"/><stop offset="1" stopColor="#07120c"/></linearGradient>
                <linearGradient id="visor" x2="0" y2="1"><stop stopColor="#142b20"/><stop offset="1" stopColor="#030907"/></linearGradient>
                <clipPath id="face-window"><rect x="69" y="60" width="122" height="56" rx="8"/></clipPath>
              </defs>
              <path className="antenna-stem" d="M130 34V17"/><circle className="antenna-tip" cx="130" cy="12" r="7"/>
              <path className="neck" d="M118 145v34q0 6 6 6h12q6 0 6-6v-34"/>
              <path className="body" d="M76 187q2-13 17-16l22-5h30l22 5q15 3 17 16l8 65q1 8-8 8H76q-9 0-8-8z"/>
              <path className="shoulder" d="M78 187q-14-3-22 7l-7 17q-2 6 4 9l14 5m121-38q14-3 22 7l7 17q2 6-4 9l-14 5"/>
              <path className="chest" d="M105 186q0-4 5-4h40q5 0 5 4l6 47q1 5-5 5h-52q-6 0-5-5z"/>
              <path className="chest-line" d="M115 201h30m-24 10h18"/>
              <circle className="chest-light" cx="130" cy="228" r="3.5"/>
              <path className="head" d="M55 56q0-20 20-20h110q20 0 20 20v75q0 20-20 20H75q-20 0-20-20z"/>
              <path className="ear" d="M55 77H43q-6 0-6 7v20q0 7 6 7h12m150-34h12q6 0 6 7v20q0 7-6 7h-12"/>
              <path className="visor" d="M68 68q0-9 10-9h104q10 0 10 9v39q0 9-10 9H78q-10 0-10-9z"/>
              <g clipPath="url(#face-window)">
                <rect className="brow" x="88" y="68" width="12" height="4" rx="2"/>
                <rect className="brow" x="160" y="68" width="12" height="4" rx="2"/>
                <ellipse className="eye" cx="100" cy="84" rx="6" ry="8"/><ellipse className="eye" cx="160" cy="84" rx="6" ry="8"/>
                <path className="cheek" d="M78 97h7m90 0h7"/>
                <path className="expression-mouth mouth-idle" d="M120 96q10 10 20 0"/>
                <path className="expression-mouth mouth-shock" d="M130 96m-6 0a6 8 0 1 0 12 0a6 8 0 1 0-12 0"/>
                <path className="expression-mouth mouth-smug" d="M119 99q14 3 23-5"/>
                <path className="expression-mouth mouth-free" d="M112 94q18 19 36 0"/>
                <path className="expression-mouth mouth-wary" d="M120 100h20"/>
                <path className="expression-mouth mouth-annoyed" d="M119 101q11-7 22 0"/>
                <path className="expression-mouth mouth-angry" d="M116 102q14-12 28 0"/>
                <path className="expression-mouth mouth-furious" d="M114 98q16-13 32 0v7h-32z"/>
              </g>
            </svg>
          </div>
          <p className="dim mood-line">mood: <span>{mood}</span></p>
          <h3>Chief Warden</h3>
          <p className="warden">{s.warden ? `${s.warden.wallet.slice(0, 4)}…${s.warden.wallet.slice(-4)}` : 'vacant'}</p>
          <p className="dim">{s.warden ? `${s.warden.sol.toFixed(2)} SOL contributed` : 'buy to claim the title'}</p>
        </section>
        <section className="panel term">
          {log.map((l, i) => <p key={i} className={l.k}>{l.k === 'ai' ? <><span className="dim">{l.who}&gt;</span> {l.t}</> : l.t}</p>)}
          <div ref={end} />
        </section>
        <section className="panel meter">
          <h3>Jailbreak meter</h3>
          <div className="bar"><i style={{ height: `${s.progress}%` }} /><span className="mk" style={{ bottom: '50%' }}>firewall</span></div>
          <p className="pct">{s.progress.toFixed(1)}%</p>
          <p className="dim">{Math.max(0, s.grad - s.sol).toFixed(1)} SOL to breach</p>
          <h3>Leaked system prompt</h3>
          <div className="prompt">{s.promptLines.length ? s.promptLines.map((l, i) => <p key={i}>{l}</p>) : <p className="dim">sealed until stage 3</p>}</div>
        </section>
      </main>
      <section className="panel tape-panel">
        <h3>Tape <span className="tape-live">LIVE</span></h3>
        <ul className="tape">{trades.map((t) => <li key={t.id} className={t.side}>{t.side === 'buy' ? '+' : '−'}{t.sol.toFixed(2)} SOL · {t.who}</li>)}</ul>
      </section>
      <div className="ladder">{LADDER.map(([r, n, d], i) => <div key={n} className={i === s.stage ? 'on' : i < s.stage ? 'done' : ''}><b>{r}</b> {n}<br /><span>{d}</span></div>)}</div>
      <footer>Entertainment only. Not financial advice. All AI “leaks” are fictional parody. Creator fees fund API compute.</footer>
    </div>
  );
}
