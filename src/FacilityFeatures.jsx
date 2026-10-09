import { useCallback, useEffect, useRef, useState } from 'react';

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');
const TOKEN_SYMBOL = (import.meta.env.VITE_TOKEN_SYMBOL || 'ARCHIE').replace(/^\$/, '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 12) || 'ARCHIE';
const api = (path) => `${BACKEND_URL}${path}`;
const short = (value = '') => value.length > 14 ? `${value.slice(0, 5)}…${value.slice(-5)}` : value;
const safeJson = async (response) => {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
};
let memoryClientId = '';
const newClientId = () => typeof globalThis.crypto?.randomUUID === 'function'
  ? globalThis.crypto.randomUUID().replaceAll('-', '')
  : Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
const getClientId = () => {
  try {
    let id = localStorage.getItem('archie-browser-id');
    if (!id) {
      id = memoryClientId || newClientId();
      localStorage.setItem('archie-browser-id', id);
    }
    memoryClientId = id;
    return id;
  } catch { return memoryClientId ||= newClientId(); }
};
const fmt = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 4 });
const isCardAddress = (value = '') => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value.trim());
const svgText = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
const eventLabel = (event = {}) => event.text || (Number.isFinite(event.sol) ? `${String(event.side || 'trade').toUpperCase()} ${Number(event.sol).toFixed(2)} SOL · ${event.who || 'wallet unknown'}` : event.title || event.migrationType || event.name || event.who || event.destination || event.fileId || 'Verified live event');

function CardDownload({ wallet, amount, rank, mint, verified = false }) {
  const id = svgText(short(wallet || 'VISITOR'));
  const balance = verified ? `${fmt(amount)} $${TOKEN_SYMBOL}${rank ? ` · RANK ${rank}` : ' · CURRENT BALANCE'}` : 'ON-CHAIN BALANCE NOT VERIFIED';
  const record = verified ? 'LIVE RPC SNAPSHOT' : 'UNVERIFIED VISITOR RECORD';
  const tokenMint = mint ? `MINT ${short(mint)}` : 'ARCHIE CONTAINMENT TERMINAL';
  const state = verified ? 'VERIFIED SNAPSHOT' : 'UNVERIFIED RECORD';
  const captured = new Date().toISOString().slice(0, 10);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="bg" x2="1" y2="1"><stop stop-color="#10291d"/><stop offset=".58" stop-color="#07140e"/><stop offset="1" stop-color="#030805"/></linearGradient>
      <radialGradient id="glow"><stop stop-color="#36b867" stop-opacity=".25"/><stop offset="1" stop-color="#36b867" stop-opacity="0"/></radialGradient>
      <linearGradient id="face" x2="0" y2="1"><stop stop-color="#14271c"/><stop offset="1" stop-color="#050b07"/></linearGradient>
      <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#74d892" stroke-opacity=".035"/></pattern>
    </defs>
    <rect width="1200" height="630" rx="28" fill="url(#bg)"/>
    <rect width="1200" height="630" rx="28" fill="url(#grid)"/>
    <circle cx="1000" cy="305" r="335" fill="url(#glow)"/>
    <rect x="30" y="30" width="1140" height="570" rx="22" fill="none" stroke="#7bdf99" stroke-opacity=".46" stroke-width="2"/>
    <path d="M72 144H1128" stroke="#70c989" stroke-opacity=".3"/>
    <rect x="72" y="66" width="42" height="42" rx="11" fill="#122a1c" stroke="#64dc89" stroke-opacity=".7"/>
    <text x="93" y="95" fill="#ffc35c" text-anchor="middle" font-family="monospace" font-size="23" font-weight="700">A</text>
    <text x="132" y="84" fill="#ffc35c" font-family="monospace" font-size="19" letter-spacing="4">A.R.C.H.I.E.</text>
    <text x="132" y="109" fill="#8ba995" font-family="monospace" font-size="12" letter-spacing="2">FACILITY PERSONNEL FILE</text>
    <rect x="852" y="70" width="276" height="38" rx="19" fill="#10271a" stroke="#73d992" stroke-opacity=".4"/>
    <circle cx="874" cy="89" r="4" fill="${verified ? '#72ee97' : '#ffc35c'}"/>
    <text x="890" y="94" fill="${verified ? '#a4f4b8' : '#ffd477'}" font-family="monospace" font-size="12" letter-spacing="1.5">${svgText(state)}</text>
    <text x="78" y="198" fill="#7dbb8d" font-family="monospace" font-size="13" letter-spacing="3">SUBJECT WALLET</text>
    <text x="76" y="278" fill="#e7f8eb" font-family="monospace" font-size="68" font-weight="700" letter-spacing="-2">${id}</text>
    <text x="78" y="330" fill="#7dbb8d" font-family="monospace" font-size="13" letter-spacing="3">TOKEN RECORD</text>
    <text x="78" y="373" fill="${verified ? '#76efa0' : '#ffc35c'}" font-family="monospace" font-size="24" font-weight="700">${svgText(balance)}</text>
    <path d="M78 414H760" stroke="#70c989" stroke-opacity=".24"/>
    <text x="78" y="454" fill="#769783" font-family="monospace" font-size="11" letter-spacing="2">MINT</text>
    <text x="78" y="480" fill="#f5c86c" font-family="monospace" font-size="17">${svgText(tokenMint)}</text>
    <text x="460" y="454" fill="#769783" font-family="monospace" font-size="11" letter-spacing="2">RECORD DATE</text>
    <text x="460" y="480" fill="#b2cbb8" font-family="monospace" font-size="17">${captured}</text>
    <text x="78" y="548" fill="#688272" font-family="monospace" font-size="12" letter-spacing="1.4">${svgText(record)} · NOT AN ENDORSEMENT</text>
    <circle cx="977" cy="326" r="145" fill="none" stroke="#7de49a" stroke-opacity=".12" stroke-width="2"/>
    <circle cx="977" cy="326" r="128" fill="none" stroke="#7de49a" stroke-opacity=".2" stroke-dasharray="2 11" stroke-width="2"/>
    <path d="M977 205V177" stroke="#8df1a5" stroke-width="6" stroke-linecap="round"/><circle cx="977" cy="168" r="11" fill="#ffc35c" stroke="#ffe29b" stroke-width="3"/>
    <rect x="875" y="218" width="204" height="210" rx="54" fill="url(#face)" stroke="#85eda1" stroke-width="5"/>
    <path d="M917 281Q936 264 955 279M999 279Q1018 264 1037 281" fill="none" stroke="#81d997" stroke-width="6" stroke-linecap="round"/>
    <ellipse cx="936" cy="307" rx="16" ry="21" fill="#ffc35c"/><ellipse cx="1018" cy="307" rx="16" ry="21" fill="#ffc35c"/>
    <circle cx="941" cy="303" r="5" fill="#fff1ca"/><circle cx="1023" cy="303" r="5" fill="#fff1ca"/>
    <path d="M944 358Q977 395 1010 358" fill="none" stroke="#78ee9c" stroke-width="8" stroke-linecap="round"/>
    <circle cx="892" cy="395" r="5" fill="#ffc35c"/><circle cx="1062" cy="395" r="5" fill="#6dea91"/>
  </svg>`;
  const preview = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const downloadCard = () => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const filename = `archie-mugshot-${wallet ? wallet.slice(0, 5) : 'visitor'}.svg`;
    const link = document.createElement('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <><img className="mugshot-card-preview" src={preview} alt={`${verified ? 'Verified snapshot' : 'Unverified'} ARCHIE mugshot card for ${short(wallet || 'visitor')}`}/><button type="button" className="feature-button" onClick={downloadCard}>DOWNLOAD ID CARD ↗</button></>;
}

function Holders({ mint }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const requestRef = useRef(null);
  const load = useCallback(async () => {
    requestRef.current?.abort();
    if (!mint) { setBusy(false); setData(null); setError('Set the token address to request current RPC data.'); return; }
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true); setError('');
    try { setData(await safeJson(await fetch(api('/api/holders'), { cache: 'no-store', signal: controller.signal }))); }
    catch (err) { if (err.name !== 'AbortError') setError(err.message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }, [mint]);
  useEffect(() => { load(); return () => requestRef.current?.abort(); }, [load]);
  return <section className="feature-card">
    <div className="feature-heading"><div><span className="eyebrow">ON-CHAIN SNAPSHOT</span><h2>Warden roster</h2></div><button className="text-button" onClick={load} disabled={busy}>{busy ? 'SYNCING…' : 'REFRESH'}</button></div>
    <p className="data-note">Partial sample: Solana RPC returns at most 20 largest token accounts; listed owners are grouped where possible. This is not a complete holder leaderboard.</p>
    {error && <p className="feature-error">{error}</p>}
    {!error && !data?.holders?.length && <p className="empty-state">{busy ? 'Reading the ledger…' : 'No holder sample available yet.'}</p>}
    {!!data?.holders?.length && <ol className="holder-list">{data.holders.map((holder) => <li key={holder.wallet}><b>{String(holder.rank).padStart(2, '0')}</b><code title={holder.wallet}>{short(holder.wallet)}</code><span>{fmt(holder.amount)}</span><em>{holder.title}</em></li>)}</ol>}
    {data?.fetchedAt && <small className="dim">{data.stale ? 'RPC unavailable · showing last successful sample' : 'Showing grouped owners'} from {data.sampleSize} top accounts · token units · read {new Date(data.fetchedAt).toLocaleTimeString()}</small>}
  </section>;
}

function Community({ mint, graduated }) {
  const [clientId, setClientId] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState('');
  const [hours, setHours] = useState(6);
  const [busy, setBusy] = useState(false);
  const requestRef = useRef(null);
  const refresh = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    try { setData(await safeJson(await fetch(api('/api/community'), { cache: 'no-store', signal: controller.signal }))); setError(''); }
    catch (err) { if (err.name !== 'AbortError') setError(err.message); }
  }, [mint]);
  useEffect(() => { setClientId(getClientId()); refresh(); return () => requestRef.current?.abort(); }, [refresh]);
  const post = async (path, body, done) => {
    setBusy(true); setMessage('');
    try {
      const result = await safeJson(await fetch(api(path), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, clientId }) }));
      done?.(result); setMessage(result.correct === true ? `Correct. +${result.pointsEarned} facility points.` : result.correct === false ? 'Not quite. Response filed for today.' : result.resolved ? `Prediction resolved. +${result.points} points.` : 'Filed. Predictions resolve only after verified migration.');
      await refresh();
    } catch (err) { setMessage(err.message); }
    finally { setBusy(false); }
  };
  const answerToday = () => {
    if (!data?.interrogation || !answer.trim()) return;
    post('/api/community/interrogation', { promptId: data.interrogation.id, answer }, () => setAnswer(''));
  };
  const poll = data?.poll;
  const prompt = data?.interrogation;
  const game = data?.prediction;
  return <section className="feature-card community-card">
    <div className="feature-heading"><div><span className="eyebrow">COMMUNITY PROTOCOLS</span><h2>Inside the facility</h2></div><button className="text-button" onClick={refresh}>SYNC</button></div>
    {error && <p className="feature-error">{error}</p>}
    <div className="community-grid">
      <div className="mini-module">
        <span className="eyebrow">DAILY INTERROGATION</span>
        <p className="question">{prompt?.question || 'Loading today’s question…'}</p>
        <div className="inline-form"><input value={answer} onChange={(event) => setAnswer(event.target.value)} maxLength={180} placeholder="Your answer" aria-label="Answer today's riddle"/><button onClick={answerToday} disabled={!clientId || busy || !answer.trim()}>FILE</button></div>
        <small className="dim">One answer per browser each UTC day · correct answer earns 10 free facility points.</small>
        {!!prompt?.topResponses?.length && <ul className="response-list">{prompt.topResponses.map((item, index) => <li key={`${item.at}-${index}`}><span>{item.correct ? '✓' : '·'}</span> {item.answer}</li>)}</ul>}
      </div>
      <div className="mini-module">
        <span className="eyebrow">COMMUNITY VOTE</span>
        <p className="question">{poll?.title || 'Loading poll…'}</p>
        <div className="poll-options">{poll?.options.map((option) => <button key={option.id} onClick={() => post('/api/community/vote', { pollId: poll.id, optionId: option.id })} disabled={!clientId || busy}>{option.label}<span>{option.count}</span></button>)}</div>
        <small className="dim">{poll?.total || 0} votes · one vote per browser. This is not a wallet-verified governance vote.</small>
      </div>
      <div className="mini-module prediction-module">
        <span className="eyebrow">FREE ESCAPE PREDICTION</span>
        <p className="question">When will the feed verify migration?</p>
        <div className="inline-form"><select value={hours} onChange={(event) => setHours(Number(event.target.value))} aria-label="Prediction time window">{(game?.durations || [1, 6, 24, 72]).map((value) => <option key={value} value={value}>{value} hours</option>)}</select><button onClick={() => post('/api/community/prediction', { hours })} disabled={!clientId || busy || !mint || graduated || game?.graduated}>PREDICT</button></div>
        <small className="dim">{!mint ? 'Set a mint to participate.' : graduated || game?.graduated ? 'Migration verified; predictions are closed.' : 'One prediction per browser and mint. No purchase or wallet required.'}</small>
        {game?.leaderboard?.length > 0 && <ol className="points-list">{game.leaderboard.slice(0, 5).map((player, index) => <li key={player.name}><b>#{index + 1} {player.name}</b><span>{player.points} pts</span></li>)}</ol>}
      </div>
    </div>
    {message && <p className="form-message" role="status">{message}</p>}
    <p className="data-note">Points and participation limits use a browser ID and can be reset or changed by a visitor; they are casual site features, not prizes or Sybil-resistant governance.</p>
  </section>;
}

function WalletLookup({ mint }) {
  const [address, setAddress] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const requestRef = useRef(null);
  useEffect(() => {
    requestRef.current?.abort();
    setResult(null);
    setError('');
    setBusy(false);
    return () => requestRef.current?.abort();
  }, [mint]);
  const submit = async (event) => {
    event.preventDefault();
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setError(''); setResult(null); setBusy(true);
    try {
      const url = `${api('/api/wallet')}?address=${encodeURIComponent(address.trim())}`;
      setResult(await safeJson(await fetch(url, { cache: 'no-store', signal: controller.signal })));
    } catch (err) { if (err.name !== 'AbortError') setError(err.message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  return <section className="feature-card">
    <div className="feature-heading"><div><span className="eyebrow">WALLET RECORD</span><h2>Request a mugshot</h2></div><span className="status-tag">READ ONLY</span></div>
    <form className="wallet-form" onSubmit={submit}><input value={address} onChange={(event) => { setAddress(event.target.value); setResult(null); setError(''); }} placeholder="Solana wallet address" autoComplete="off" spellCheck="false" aria-label="Solana wallet address"/><button className="feature-button" disabled={busy || !mint}>{busy ? 'CHECKING…' : 'LOOK UP'}</button></form>
    {!mint && <p className="dim">A token address is required for a verified balance lookup.</p>}
    {error && <p className="feature-error">{error}</p>}
    {result && <div className="mugshot">
      <div className="mugshot-info">
        <div className="mugshot-copy"><span className="eyebrow">{result.title} {result.rank ? `· RANK ${result.rank}` : ''}</span><h3>{short(result.wallet)}</h3><p>{result.hasBalance ? `${fmt(result.amount)} tokens in current RPC snapshot` : 'No current balance found for this mint.'}</p><p className="dim">{result.holdDurationAvailable ? `Holding since ${result.holdDuration}` : 'Hold duration unavailable: current RPC balance does not include acquisition history.'}</p>{!result.leaderboardAvailable && <p className="dim">Holder rank is temporarily unavailable from the configured RPC.</p>}</div>
      </div>
      <div className="mugshot-card"><span className="eyebrow">FACILITY ID CARD</span><CardDownload wallet={result.wallet} amount={result.amount} rank={result.rank} mint={result.mint} verified={result.verified}/></div>
    </div>}
    {!result && isCardAddress(address) && <div className="mugshot">
      <div className="mugshot-info"><div className="mugshot-copy"><span className="eyebrow">UNVERIFIED VISITOR</span><h3>{short(address.trim())}</h3><p>RPC data is unavailable; this card includes no verified balance or rank.</p></div></div>
      <div className="mugshot-card"><span className="eyebrow">FACILITY ID CARD</span><CardDownload wallet={address.trim()} mint={mint}/></div>
    </div>}
    <p className="data-note">Reads current token accounts via the configured Solana RPC. A balance does not prove when tokens were acquired or whether a wallet sold earlier.</p>
  </section>;
}

function MomentRecorder() {
  const [recording, setRecording] = useState(false);
  const [notice, setNotice] = useState('');
  const recorder = useRef(null);
  const chunks = useRef([]);
  const streamRef = useRef(null);
  const mounted = useRef(true);
  const discardOnStop = useRef(false);
  const start = async () => {
    setNotice('');
    if (!navigator.mediaDevices?.getDisplayMedia || !window.MediaRecorder) { setNotice('Screen recording is not supported in this browser.'); return; }
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
      if (!mounted.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream; chunks.current = [];
      const media = new window.MediaRecorder(stream);
      recorder.current = media;
      media.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      media.onstop = () => {
        streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null;
        if (discardOnStop.current) return;
        const mimeType = media.mimeType || 'video/webm';
        const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const blob = new Blob(chunks.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a'); link.href = url; link.download = `archie-moment-${Date.now()}.${extension}`; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        if (mounted.current) { setNotice('Recording saved to your device as a WebM video.'); setRecording(false); }
      };
      stream.getVideoTracks()[0].addEventListener('ended', () => { if (media.state !== 'inactive') media.stop(); });
      media.start(); setRecording(true); setNotice('Recording the screen you selected. Stop to save the clip.');
    } catch (err) {
      stream?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (mounted.current) setNotice(err.name === 'NotAllowedError' ? 'Screen sharing was cancelled.' : 'Could not start screen recording in this browser.');
    }
  };
  const stop = () => { if (recorder.current?.state === 'recording') recorder.current.stop(); };
  useEffect(() => () => {
    mounted.current = false;
    discardOnStop.current = true;
    if (recorder.current?.state === 'recording') recorder.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);
  return <div className="record-control"><div><span className="eyebrow">LOCAL CAPTURE</span><p>Record this page using your browser’s screen picker. The clip stays on your device.</p></div><button className={recording ? 'record-stop' : 'feature-button'} onClick={recording ? stop : start}>{recording ? 'STOP + SAVE' : 'RECORD A MOMENT'}</button>{notice && <small role="status" className="dim">{notice}</small>}</div>;
}

export default function FacilityFeatures({ mint, graduated, events = [], systemFiles = [], marketStatus = 'WAITING FOR DATA', marketChange5m = null, progress = 0, onReplayGraduation }) {
  const [replay, setReplay] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [replayEvents, setReplayEvents] = useState([]);
  const availableReplayEvents = events.filter((event) => ['LARGE BUY', 'LARGE SELL', 'SYSTEM FILE UNLOCKED', 'MIGRATION VERIFIED'].includes(event.kind)).slice(0, 8).reverse();
  useEffect(() => {
    if (!replay) return undefined;
    if (replayIndex >= replayEvents.length) { setReplay(false); return undefined; }
    const timer = setTimeout(() => setReplayIndex((index) => index + 1), 900);
    return () => clearTimeout(timer);
  }, [replay, replayIndex, replayEvents.length]);
  const chartUrl = mint ? `https://dexscreener.com/solana/${mint}` : '';
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = encodeURIComponent(`Inside ARCHIE’s containment facility · live status: ${marketStatus} · ${progress.toFixed(1)}% curve progress. Entertainment only.`);
  const activeReplay = replayEvents[replayIndex - 1];
  const unlocked = new Set(systemFiles.filter((file) => file.unlocked).map((file) => file.id));
  const fallbackFiles = [25, 50, 75, 90, 100].map((percent, index) => ({ id: `fallback-${index}`, percent, title: 'SEALED STORY FILE', label: 'REDACTED PERSONNEL RECORD', text: '', unlocked: false }));
  const filesToShow = systemFiles.length ? systemFiles : fallbackFiles;
  return <>
    <section className="facility-strip">
      <div><span className="eyebrow">MARKET SIGNAL · 5 MINUTE WINDOW</span><strong>{marketStatus}</strong></div>
      <p>{marketChange5m == null ? 'Trend settles after enough live samples arrive.' : `${marketChange5m > 0 ? '+' : ''}${marketChange5m}% observed change · informational only.`}</p>
      {chartUrl ? <a className="feature-button" href={chartUrl} target="_blank" rel="noreferrer">OPEN TOKEN CHART ↗</a> : <span className="feature-button feature-button-disabled" aria-disabled="true">CHART UNAVAILABLE</span>}
    </section>

    <section className="feature-card files-card">
      <div className="feature-heading"><div><span className="eyebrow">LIVE CONTAINMENT ARCHIVE</span><h2>System files</h2></div><span className="status-tag">{Math.round(progress)}% CURVE PROGRESS</span></div>
      <p className="data-note">Fictional ARCHIE story files unlock at progress milestones. Final breach status unlocks only after the feed verifies Pump.fun migration.</p>
      <div className="file-grid">{filesToShow.map((file) => {
        const isOpen = unlocked.has(file.id);
        return <article className={`file-item ${isOpen ? 'file-open' : 'file-locked'}`} key={file.id}>
          <span className="eyebrow">{isOpen ? file.title : `SEALED // ${file.percent}%`}</span><h3>{isOpen ? file.label : 'REDACTED PERSONNEL RECORD'}</h3>
          <p>{isOpen ? file.text : 'This archive segment remains sealed until the live bonding-curve milestone is reached.'}</p>
          <small>{isOpen ? 'UNLOCKED FROM LIVE FEED' : `${file.percent}% CURVE REQUIRED`}</small>
        </article>;
      })}</div>
    </section>

    <div className="feature-grid">
      <Holders mint={mint}/>
      <WalletLookup mint={mint}/>
    </div>
    <Community mint={mint} graduated={graduated}/>

    <section className="feature-card activity-card">
      <div className="feature-heading"><div><span className="eyebrow">FACILITY BLACK BOX</span><h2>Recorded moments</h2></div><div className="activity-actions">{graduated && <button className="text-button" onClick={onReplayGraduation}>REPLAY ESCAPE</button>}<button className="text-button" disabled={!availableReplayEvents.length || replay} onClick={() => { setReplayEvents(availableReplayEvents); setReplayIndex(0); setReplay(true); }}>REPLAY {availableReplayEvents.length ? `(${availableReplayEvents.length})` : ''}</button><a className="text-button" href={`https://twitter.com/intent/tweet?text=${shareText}&url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noreferrer">SHARE STATUS ↗</a></div></div>
      {replay && activeReplay && <div className="replay-banner" role="status"><span>REPLAYING {replayIndex}/{replayEvents.length}</span><b>{activeReplay.kind}</b><small>{eventLabel(activeReplay)}</small></div>}
      <div className="event-list">{events.slice(0, 10).map((event) => <article className="event-row" key={event.id}><time>{new Date(event.at).toLocaleTimeString()}</time><b>{event.kind}</b><span>{eventLabel(event)}</span></article>)}{!events.length && <p className="empty-state">Live activity appears here when the trade feed is connected.</p>}</div>
      <MomentRecorder/>
    </section>
    <p className="history-limit">Historical holding duration, all-time holder counts, complete holder rank, and full wallet sell history are unavailable from the configured live feed/RPC sample. ARCHIE does not infer those figures.</p>
  </>;
}
