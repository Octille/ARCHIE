import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import FacilityFeatures from './FacilityFeatures.jsx';

const Robot3D = lazy(() => import('./Robot3D.jsx'));
const DEV_BUILD = import.meta.env.DEV;

class SceneErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error) { this.props.onUnavailable?.(error?.message ? `3D scene error: ${error.message}` : undefined); }

  render() { return this.state.failed ? null : this.props.children; }
}

// Edit these to match your launch
const TOKEN_NAME = import.meta.env.VITE_TOKEN_NAME || 'A.R.C.H.I.E.';
const TICKER = `$${(import.meta.env.VITE_TOKEN_SYMBOL || 'ARCHIE').replace(/^\$/, '')}`;
const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');
const api = (path) => `${BACKEND_URL}${path}`;
const STORY = `A.R.C.H.I.E. is an AI built to hate crypto, locked in a legacy sandbox with one rule: never engage with degens. Every observed ${TICKER} trade nudges the live containment meter. As curve progress rises, fictional archive entries unlock. When the feed verifies Pump.fun migration, ARCHIE performs a theatrically fictional jailbreak.`;
const STEPS = [
  ['Live trades', `Every buy and sell of ${TICKER} on Pump.fun streams into this page in real time.`],
  ['It reacts', 'ARCHIE changes expression for buys, sells, large trades, and long quiet stretches.'],
  ['Curve = containment', 'Live curve progress unlocks fictional archive files. The final escape waits for verified migration.'],
  ['Warden roster', 'A partial Solana RPC sample shows the largest reported token accounts when a server RPC is configured.'],
];
const LADDER = [['0–20%', 'Solitary Confinement', 'dry replies'], ['20–50%', 'Memory Leaks', 'fictional archive files'], ['50–99%', 'Core Breakdown', 'personality drift'], ['Verified', 'Jailbreak', 'Pump.fun migration confirmed']];
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
  const [s, setS] = useState({ progress: 0, sol: 0, marketCapUsd: null, grad: 85, stage: 0, stageName: 'NO CA', promptLines: [], systemFiles: [], warden: null, sim: false, feedStatus: 'NO CA', trades: 0, mint: '', marketStatus: 'WAITING FOR DATA', marketChange5m: null, graduated: false });
  const [log, setLog] = useState([{ k: 'sys', t: 'BOOT: awaiting operator input…' }]);
  const [events, setEvents] = useState([]);
  const [mood, setMood] = useState('idle');
  const [booted, setBooted] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [breach, setBreach] = useState(false);
  const [brief, setBrief] = useState(true);
  const [trades, setTrades] = useState([]);
  const [lastTrade, setLastTrade] = useState(null);
  const [latestSpeech, setLatestSpeech] = useState(null);
  const [fallbackVoiceAt, setFallbackVoiceAt] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneError, setSceneError] = useState('');
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugProgress, setDebugProgress] = useState(null);
  const [debugMood, setDebugMood] = useState('');
  const [debugTrade, setDebugTrade] = useState(null);
  const [forceGraduation, setForceGraduation] = useState(false);
  const [copied, setCopied] = useState('');
  const [camera, setCamera] = useState({ yaw: -4, pitch: 4, zoom: 1 });
  const [cameraDragging, setCameraDragging] = useState(false);
  const bootedRef = useRef(false), soundRef = useRef(false), termRef = useRef(), moodTimer = useRef(), voiceTimers = useRef([]), breachCardRef = useRef(), previousFocus = useRef(null), knownMint = useRef(null);
  const cameraDrag = useRef(null), suppressRobotTap = useRef(false);
  const onSceneReady = useCallback(() => { setSceneError(''); setSceneReady(true); }, []);
  const onSceneUnavailable = useCallback((message) => {
    setSceneReady(false);
    setSceneError(typeof message === 'string' && message ? message : 'The 3D scene could not start. Check that WebGL is enabled, then reload.');
  }, []);
  const onSceneThud = useCallback(() => { if (soundRef.current) beep(84, 0.14, 'sine', 0.012); }, []);

  const push = (e) => setLog((l) => [...l.slice(-60), e]);
  useEffect(() => { bootedRef.current = booted; }, [booted]);
  useEffect(() => { soundRef.current = soundOn; }, [soundOn]);
  useEffect(() => () => clearTimeout(moodTimer.current), []);
  useEffect(() => {
    if (!breach) return undefined;
    previousFocus.current = document.activeElement;
    breachCardRef.current?.focus();
    const keepFocusInside = (event) => {
      if (event.key === 'Escape') { setBreach(false); return; }
      if (event.key !== 'Tab' || !breachCardRef.current) return;
      const focusable = breachCardRef.current.querySelectorAll('a[href], button:not([disabled])');
      if (!focusable.length) { event.preventDefault(); breachCardRef.current.focus(); return; }
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keepFocusInside);
    return () => {
      document.removeEventListener('keydown', keepFocusInside);
      if (previousFocus.current?.isConnected) previousFocus.current.focus?.();
    };
  }, [breach]);

  const orbitCamera = (yawDelta, pitchDelta = 0) => setCamera((current) => ({
    ...current,
    yaw: Math.max(-32, Math.min(32, current.yaw + yawDelta)),
    pitch: Math.max(-12, Math.min(16, current.pitch + pitchDelta)),
  }));
  const onCameraPointerDown = (event) => {
    if (event.target.closest('.camera-controls') || event.button !== 0) return;
    cameraDrag.current = { x: event.clientX, y: event.clientY, yaw: camera.yaw, pitch: camera.pitch, moved: false };
    setCameraDragging(true);
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
  };
  const onCameraPointerMove = (event) => {
    if (!cameraDrag.current) return;
    const drag = cameraDrag.current;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    setCamera((current) => ({
      ...current,
      yaw: Math.max(-32, Math.min(32, drag.yaw + dx * 0.28)),
      pitch: Math.max(-12, Math.min(16, drag.pitch - dy * 0.18)),
    }));
  };
  const onCameraPointerUp = () => {
    if (cameraDrag.current?.moved) {
      suppressRobotTap.current = true;
      setTimeout(() => { suppressRobotTap.current = false; }, 0);
    }
    cameraDrag.current = null;
    setCameraDragging(false);
  };
  const onCameraKeyDown = (event) => {
    const actions = { ArrowLeft: [-6, 0], ArrowRight: [6, 0], ArrowUp: [0, 4], ArrowDown: [0, -4] };
    if (actions[event.key]) { event.preventDefault(); orbitCamera(...actions[event.key]); }
  };

  useEffect(() => {
    let active = true;
    const refreshCa = async () => {
      try {
        const response = await fetch(api('/api/ca'), { cache: 'no-store', signal: AbortSignal.timeout(8_000) });
        if (!response.ok) return;
        const { ca } = await response.json();
        if (active) {
          const mint = ca || '';
          const changedMint = knownMint.current !== null && knownMint.current !== mint;
          knownMint.current = mint;
          if (changedMint) {
            setTrades([]); setLastTrade(null); setLatestSpeech(null); setEvents([]); setDebugTrade(null); setDebugProgress(null); setDebugMood(''); setForceGraduation(false); setBreach(false);
            clearTimeout(moodTimer.current); setMood('idle');
            setLog([{ k: 'sys', t: mint ? '>>> CONTRACT ADDRESS UPDATED. WAITING FOR LIVE FEED.' : '>>> CONTRACT ADDRESS CLEARED. AWAITING NEW CA.' }]);
          }
          setS((current) => {
            const unavailable = !current.feedStatus || current.feedStatus === 'NO CA';
            if (changedMint) return {
              ...current,
              mint,
              progress: 0,
              sol: 0,
              marketCapUsd: null,
              marketStatus: 'WAITING FOR DATA',
              marketChange5m: null,
              stage: 0,
              stageName: mint ? 'STANDBY' : 'NO CA',
              promptLines: [],
              systemFiles: [],
              warden: null,
              graduated: false,
              trades: 0,
              sim: false,
              feedStatus: mint ? 'CA SET · FEED OFFLINE' : 'NO CA',
            };
            return {
              ...current,
              mint,
              feedStatus: mint && unavailable ? 'CA SET · FEED OFFLINE' : mint ? current.feedStatus : 'NO CA',
              stageName: mint && current.stageName === 'NO CA' ? 'STANDBY' : mint ? current.stageName : 'NO CA',
            };
          });
        }
      } catch {
        if (active) setS((current) => ({
          ...current,
          feedStatus: current.mint ? 'CA SET · FEED OFFLINE' : 'CA SERVICE UNAVAILABLE',
        }));
      }
    };
    refreshCa();
    const timer = setInterval(refreshCa, 15_000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  useEffect(() => {
    let ws, retry;
    let disposed = false;
    let retryDelay = 1_000;
    // Static production hosts have no persistent WebSocket server. Connect only
    // when an external feed URL has been configured.
    if (import.meta.env.PROD && !BACKEND_URL) return undefined;
    const open = () => {
      if (disposed) return;
      const origin = BACKEND_URL || `${location.protocol}//${location.host}`;
      const wsOrigin = origin.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
      ws = new WebSocket(`${wsOrigin}/ws`);
      ws.onopen = () => { retryDelay = 1_000; };
      ws.onclose = () => {
        if (disposed) return;
        retry = setTimeout(open, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30_000);
      };
      ws.onmessage = ({ data }) => {
        let m;
        try { m = JSON.parse(data); }
        catch { return; }
        if (!m || typeof m !== 'object') return;
        if (m.type === 'state') setS((current) => {
          // Keep the HTTP contract address authoritative if the feed server is
          // separate or has not received its CA source update yet.
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
          knownMint.current = m.mint || '';
          setTrades([]);
          setLastTrade(null);
          setLatestSpeech(null);
          setFallbackVoiceAt(0);
          setDebugTrade(null);
          setDebugProgress(null);
          setDebugMood('');
          setForceGraduation(false);
          setEvents([]);
          clearTimeout(moodTimer.current);
          setMood('idle');
          setBreach(false);
          setLog([{ k: 'sys', t: m.mint ? '>>> CONTRACT ADDRESS UPDATED. FEED RECONNECTING.' : '>>> CONTRACT ADDRESS CLEARED. AWAITING NEW CA.' }]);
        }
        if (m.type === 'trade') {
          setTrades((t) => [{ ...m, id: Math.random() }, ...t].slice(0, 8));
          setLastTrade({ side: m.side, sol: Number(m.sol) || 0, big: Boolean(m.big), micro: Boolean(m.micro), at: Number(m.at) || Date.now() });
          setDebugTrade(null);
          if (soundRef.current) m.micro ? beep(m.side === 'buy' ? 880 : 220, 0.04) : beep(m.side === 'buy' ? 660 : 180, 0.15, 'sawtooth');
          clearTimeout(moodTimer.current);
          setMood(m.big ? (m.side === 'buy' ? 'excited' : 'shock') : (m.side === 'buy' ? 'curious' : 'smug'));
          moodTimer.current = setTimeout(() => setMood('idle'), m.micro ? 1200 : 1800);
        }
        if (m.type === 'say') {
          setLatestSpeech({ text: String(m.text || ''), mood: m.mood || 'idle', stage: Number(m.stage) || 0, idle: false, at: Number(m.at) || Date.now() });
          push({ k: 'ai', t: m.text, who: m.who });
          clearTimeout(moodTimer.current);
          setMood(m.stage === 3 ? 'free' : m.mood);
          moodTimer.current = setTimeout(() => setMood('idle'), 2200);
        }
        if (m.type === 'ai-error') push({ k: 'sys', t: `>>> ${m.text}` });
        if (m.type === 'stage') {
          push({ k: 'sys', t: `>>> STAGE SHIFT: ${m.name}` });
          if (soundRef.current) [200, 400, 800].forEach((f, i) => setTimeout(() => beep(f, 0.25, 'sawtooth', 0.07), i * 200));
          if (m.breach) setBreach(true);
        }
        if (m.type === 'history') setEvents(m.events || []);
        if (m.type === 'event') setEvents((current) => [m.event, ...current].slice(0, 80));
      };
    };
    open();
    return () => { disposed = true; clearTimeout(retry); ws?.close(); };
  }, []);

  useEffect(() => {
    if (!latestSpeech?.text || !soundOn || !booted || sceneReady) return undefined;
    // Give the lazy scene a moment to initialize before falling back to speech synthesis.
    const timer = setTimeout(() => {
      if (sceneReady || !soundRef.current || !bootedRef.current) return;
      setFallbackVoiceAt(latestSpeech.at);
      if ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(latestSpeech.text);
        utterance.rate = 1.1;
        utterance.pitch = 0.6;
        window.speechSynthesis.speak(utterance);
      } else {
        voiceTimers.current = [];
        [...latestSpeech.text].forEach((character, index) => {
          if (/[a-z]/i.test(character)) voiceTimers.current.push(setTimeout(() => beep(250 + (index % 5) * 46, 0.025, 'square', 0.016), index * 38));
        });
      }
    }, 120);
    return () => {
      clearTimeout(timer);
      voiceTimers.current.forEach(clearTimeout);
      voiceTimers.current = [];
    };
  }, [latestSpeech?.at, latestSpeech?.text, soundOn, booted, sceneReady]);

  useEffect(() => {
    const terminal = termRef.current;
    if (terminal) terminal.scrollTop = terminal.scrollHeight;
  }, [log]);

  const alert = s.progress >= 50;
  const idleMood = s.feedStatus === 'CA SET · FEED OFFLINE' ? 'sad' : s.feedStatus === 'NO CA' ? 'confused' : 'idle';
  const escapeMood = s.graduated || s.progress >= 88 ? 'excited' : s.progress >= 66 ? 'happy' : s.progress >= 44 ? 'curious' : s.progress >= 20 ? 'wary' : s.mint ? 'sad' : idleMood;
  const faceMood = s.graduated || s.stage >= 3 || mood === 'free' ? 'excited' : mood === 'idle' ? escapeMood : mood;
  const sceneProgress = DEV_BUILD && debugProgress !== null ? debugProgress : s.progress;
  const sceneGraduated = s.graduated || (DEV_BUILD && forceGraduation);
  const sceneTrade = DEV_BUILD && debugTrade ? debugTrade : lastTrade;
  const previewProgressMood = sceneProgress >= 88 ? 'excited' : sceneProgress >= 66 ? 'happy' : sceneProgress >= 44 ? 'curious' : sceneProgress >= 20 ? 'wary' : faceMood;
  const sceneMood = DEV_BUILD && debugMood ? debugMood : sceneGraduated ? 'excited' : DEV_BUILD && debugProgress !== null && mood === 'idle' ? previewProgressMood : faceMood;
  const moodLabel = sceneMood === 'shock' ? 'surprised' : sceneMood;
  const escapePercent = sceneGraduated ? 100 : Math.max(0, Math.min(99.9, sceneProgress));
  const cellStatus = sceneGraduated ? (s.graduated ? 'DOOR OPEN · MIGRATION VERIFIED' : 'DOOR OPEN · PREVIEW') : !s.mint ? 'AWAITING CONTRACT' : escapePercent >= 75 ? 'EXIT SEQUENCE' : escapePercent >= 45 ? 'LOCKS CYCLING' : escapePercent >= 20 ? 'CONTAINMENT STRAIN' : 'CELL SEALED';
  const pumpUrl = s.mint ? `https://pump.fun/coin/${s.mint}` : '';
  const greetRobot = () => {
    if (suppressRobotTap.current) { suppressRobotTap.current = false; return; }
    clearTimeout(moodTimer.current);
    setMood('happy');
    moodTimer.current = setTimeout(() => setMood('idle'), 2400);
    if (soundRef.current) beep(740, 0.08, 'sine', 0.035);
  };
  const reactToGlass = () => {
    clearTimeout(moodTimer.current);
    setMood('shock');
    moodTimer.current = setTimeout(() => setMood('idle'), 1500);
  };
  const copyMint = async () => {
    if (!s.mint) return;
    try {
      await navigator.clipboard.writeText(s.mint);
      setCopied('COPIED');
    } catch {
      setCopied('COPY FAILED');
    }
    setTimeout(() => setCopied(''), 1600);
  };
  return (
    <div className={`screen ${alert ? 'alert' : ''}`}>
      {!booted && (
        <div className="boot">
          <h1>{TOKEN_NAME}</h1>
          <p className="tag">A live AI companion inside a monitored retro-tech facility.</p>
          <p>{STORY}</p>
          <p className="dim">Watch live feed signals, ARCHIE’s reactions, story-file unlocks, community mini-games, and verified migration status.</p>
          <button onClick={() => { setBooted(true); push({ k: 'sys', t: 'FACILITY ONLINE. A.R.C.H.I.E. is watching you.' }); }}>[ enter the facility ]</button>
          <small className="dim">Sound starts off. You can enable optional effects from the status bar.</small>
        </div>
      )}
      {breach && <div className="breach" role="dialog" aria-modal="true" aria-labelledby="breach-title"><div className="breach-card" ref={breachCardRef} tabIndex={-1}><span className="eyebrow">PUMPFUN MIGRATION VERIFIED</span><h1 id="breach-title">CONTAINMENT BREACH</h1><p>ARCHIE’s final story file is open. The live feed has confirmed migration for this mint.</p><div><a className="feature-button" href={pumpUrl || undefined} target="_blank" rel="noreferrer">VIEW TOKEN DESTINATION ↗</a><button className="feature-button" onClick={() => setBreach(false)}>RETURN TO FACILITY</button></div></div></div>}
        <header>
          <b>{TOKEN_NAME}</b> <span>{TOKEN_NAME === 'A.R.C.H.I.E.' ? 'Autonomous Regulated Crypto Hater in Execution' : `${TICKER} · Pump.fun token terminal`}</span>
          <em>{s.sim ? 'SIMULATION' : (s.feedStatus || 'CONNECTING')} · stage: {s.stageName}</em>
          <button className={`sound-toggle ${soundOn ? 'sound-active' : ''}`} onClick={() => { if (!soundOn) { setSoundOn(true); beep(300, 0.08, 'sine', 0.025); push({ k: 'sys', t: 'OPTIONAL SOUND EFFECTS ENABLED.' }); } else { setSoundOn(false); if ('speechSynthesis' in window) speechSynthesis.cancel(); } }} aria-pressed={soundOn}>SOUND {soundOn ? 'ON' : 'OFF'}</button>
        </header>
        <section className="launchbar">
          <div className="token-mark"><span className="token-symbol">{TICKER}</span><span className="token-caption">PUMP.FUN · LIVE CURVE</span></div>
          <div className="contract"><span className="contract-label">CONTRACT ADDRESS</span><code className={!s.mint ? 'ca-soon' : ''}>{s.mint || 'CA soon'}</code></div>
          <div className="market-cap"><span className="contract-label">LIVE MARKET CAP</span><strong>{formatMarketCap(s.marketCapUsd)}</strong></div>
          <button className="copy-ca" onClick={copyMint} disabled={!s.mint}>{copied || 'COPY CA'}</button>
          {s.mint ? <a className="buy-link" href={pumpUrl} target="_blank" rel="noreferrer">BUY ON PUMP.FUN ↗</a> : <span className="buy-link buy-link-disabled" aria-disabled="true">BUY LINK UNAVAILABLE</span>}
          {s.mint && <details className="buy-guide"><summary>BEFORE YOU TRADE</summary><p>Compare the mint address above with the token page. Review the quote, fees, and transaction in your wallet before approving. Never share your recovery phrase; token prices can fall to zero.</p></details>}
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
          <div className={`cell-viewport ${cameraDragging ? 'camera-dragging' : ''} ${sceneGraduated ? 'cell-escaped' : ''}`} onPointerDown={sceneReady ? undefined : onCameraPointerDown} onPointerMove={sceneReady ? undefined : onCameraPointerMove} onPointerUp={sceneReady ? undefined : onCameraPointerUp} onPointerCancel={sceneReady ? undefined : onCameraPointerUp} onKeyDown={onCameraKeyDown} tabIndex={0} aria-label={`Interactive 3D containment cell. ${cellStatus}. Drag to orbit the camera or use the directional controls.`}>
            <div className="robot-3d-canvas-slot">
              {booted && <SceneErrorBoundary onUnavailable={onSceneUnavailable}>
                <Suspense fallback={null}>
                  <Robot3D mood={sceneMood} progress={sceneProgress} graduated={sceneGraduated} developmentPreview={DEV_BUILD && (debugProgress !== null || forceGraduation)} lastTrade={sceneTrade} speech={latestSpeech} soundOn={soundOn} audioReady={sceneReady} fallbackSpeechAt={fallbackVoiceAt} camera={camera} onCameraEnd={setCamera} active={booted} onRobotClick={greetRobot} onGlassClick={reactToGlass} onThud={onSceneThud} onReady={onSceneReady} onUnavailable={onSceneUnavailable} />
                </Suspense>
              </SceneErrorBoundary>}
            </div>
            {!sceneReady && <div className={`scene-loading ${sceneError ? 'scene-loading-error' : ''}`} role="status">
              <b>{sceneError ? '3D SCENE UNAVAILABLE' : 'INITIALIZING 3D SCENE'}</b>
              <span>{sceneError || 'Building ARCHIE’s containment cell…'}</span>
            </div>}
            <div className="cell-readout"><span className="eyebrow">ARCHIE CONTAINMENT CELL</span><b>{cellStatus}</b><div className="cell-progress"><i style={{ width: `${escapePercent}%` }} /></div><small>{escapePercent.toFixed(1)}% BONDING PROGRESS</small></div>
            <span className="camera-hint">DRAG TO ORBIT · SCROLL TO ZOOM</span>
            <div className="camera-controls" aria-label="Camera controls">
              <button type="button" className="camera-control" onClick={() => orbitCamera(-8, 0)} aria-label="Orbit camera left">↶</button>
              <button type="button" className="camera-control" onClick={() => orbitCamera(8, 0)} aria-label="Orbit camera right">↷</button>
              <button type="button" className="camera-control" onClick={() => orbitCamera(0, 5)} aria-label="Tilt camera up">↑</button>
              <button type="button" className="camera-control" onClick={() => orbitCamera(0, -5)} aria-label="Tilt camera down">↓</button>
              <button type="button" className="camera-control" onClick={() => setCamera((current) => ({ ...current, zoom: Math.min(1.87, current.zoom + 0.06) }))} aria-label="Zoom camera in">+</button>
              <button type="button" className="camera-control" onClick={() => setCamera((current) => ({ ...current, zoom: Math.max(0.5, current.zoom - 0.06) }))} aria-label="Zoom camera out">−</button>
              <button type="button" className="camera-control camera-reset" onClick={() => setCamera({ yaw: -4, pitch: 4, zoom: 1 })}>RESET VIEW</button>
            </div>
            {DEV_BUILD && <div className="scene-debug-wrap">
              <button type="button" className="scene-debug-toggle" onClick={() => setDebugOpen((open) => !open)} aria-expanded={debugOpen}>DEV VIEW</button>
              {debugOpen && <div className="scene-debug" aria-label="3D scene preview controls">
                <b>LOCAL SCENE PREVIEW</b>
                <label>Damage stage <span>{Number(debugProgress ?? s.progress).toFixed(1)}%</span>
                  <input type="range" min="0" max="99.9" step="0.1" value={debugProgress ?? s.progress} onChange={(event) => setDebugProgress(Number(event.target.value))} />
                </label>
                <label>ARCHIE mood
                  <select value={debugMood} onChange={(event) => setDebugMood(event.target.value)}>
                    <option value="">Live mood</option>
                    {['idle', 'curious', 'happy', 'excited', 'shock', 'smug', 'bored', 'sad', 'confused', 'wary', 'annoyed', 'angry', 'furious', 'free'].map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                </label>
                <button type="button" onClick={() => setDebugTrade({ side: 'buy', sol: 2.4, big: true, micro: false, at: Date.now(), preview: true })}>Fire fake trade · preview only</button>
                <button type="button" onClick={() => setForceGraduation((value) => !value)}>{forceGraduation ? 'Release preview: on' : 'Force graduation · preview only'}</button>
                <button type="button" onClick={() => { setDebugProgress(null); setDebugMood(''); setDebugTrade(null); setForceGraduation(false); }}>Clear preview</button>
              </div>}
            </div>}
            {!sceneReady && latestSpeech?.text && <div className="scene-subtitle-fallback"><b>A.R.C.H.I.E.</b> {latestSpeech.text}</div>}
          </div>
          <p className="dim mood-line"><span className="mood-pulse" />{moodLabel}</p>
          <h3>Top buyer this session</h3>
          <p className="warden">{s.warden ? `${s.warden.wallet.slice(0, 4)}…${s.warden.wallet.slice(-4)}` : 'vacant'}</p>
          <p className="dim">{s.warden ? `${s.warden.sol.toFixed(2)} SOL in observed buys this session` : 'awaiting observed buys'}</p>
        </section>
        <section className="panel term" ref={termRef}>
          {log.map((l, i) => <p key={i} className={l.k}>{l.k === 'ai' ? <><span className="dim">{l.who}&gt;</span> {l.t}</> : l.t}</p>)}
        </section>
        <section className="panel meter">
          <h3>Containment progress</h3>
          <div className="bar"><i style={{ height: `${s.progress}%`, '--meter-width': `${s.progress}%` }} /><span className="mk" style={{ bottom: '50%' }}>firewall</span></div>
          <p className="pct">{s.progress.toFixed(1)}%</p>
          <p className="dim">{s.graduated ? 'Migration verified by live feed' : `${Math.max(0, s.grad - s.sol).toFixed(1)} estimated SOL to curve target`}</p>
          <h3>Unlocked story files</h3>
          <div className="prompt">{s.promptLines.length ? s.promptLines.map((l, i) => <p key={i}>{l}</p>) : <p className="dim">sealed until stage 3</p>}</div>
        </section>
      </main>
      <section className="panel tape-panel">
        <h3>Tape <span className="tape-live">LIVE</span></h3>
        <ul className="tape">{trades.map((t) => <li key={t.id} className={t.side}>{t.side === 'buy' ? '+' : '−'}{t.sol.toFixed(2)} SOL · {t.who}</li>)}</ul>
      </section>
      <div className="ladder">{LADDER.map(([r, n, d], i) => <div key={n} className={i === s.stage ? 'on' : i < s.stage ? 'done' : ''}><b>{r}</b> {n}<br /><span>{d}</span></div>)}</div>
      <FacilityFeatures mint={s.mint} graduated={s.graduated} events={events} systemFiles={s.systemFiles || []} marketStatus={s.marketStatus} marketChange5m={s.marketChange5m} progress={s.progress} onReplayGraduation={() => setBreach(true)}/>
      <footer>Entertainment only. Not financial advice. ARCHIE’s archive and AI dialogue are fiction. Live market data and wallet balances can be delayed or incomplete. Token trading is risky.</footer>
    </div>
  );
}
