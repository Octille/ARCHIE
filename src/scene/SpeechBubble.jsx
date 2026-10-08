import { useEffect, useRef, useState } from 'react';
import { Html } from '@react-three/drei';

export default function SpeechBubble({ speech, ambientSpeech, soundOn, audioReady = true, fallbackSpeechAt = 0 }) {
  const message = !ambientSpeech?.text || Number(speech?.at || 0) > Number(ambientSpeech.at || 0) ? speech : ambientSpeech;
  const alreadySpoken = Boolean(message?.at && fallbackSpeechAt === message.at);
  const [shown, setShown] = useState('');
  const [visible, setVisible] = useState(false);
  const spokenAt = useRef(0);
  const suppressedAt = useRef(0);
  const audioContext = useRef(null);

  useEffect(() => {
    if (!message?.text) { setShown(''); setVisible(false); return undefined; }
    let cursor = 0;
    let alive = true;
    setShown('');
    setVisible(true);
    const typeTimer = window.setInterval(() => {
      if (!alive) return;
      cursor = Math.min(message.text.length, cursor + 1);
      setShown(message.text.slice(0, cursor));
      if (cursor >= message.text.length) window.clearInterval(typeTimer);
    }, 26);
    const hideTimer = window.setTimeout(() => setVisible(false), Math.max(5500, message.text.length * 32 + 2800));
    return () => {
      alive = false;
      window.clearInterval(typeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [message?.at, message?.text]);

  useEffect(() => {
    if (message?.at && !soundOn) suppressedAt.current = message.at;
  }, [message?.at, soundOn]);

  useEffect(() => {
    if (!message?.text || !message?.at || spokenAt.current === message.at) return undefined;
    if (alreadySpoken) { spokenAt.current = message.at; return undefined; }
    if (!soundOn || !audioReady || suppressedAt.current === message.at) return undefined;
    spokenAt.current = message.at;
    if ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(message.text);
      const voices = window.speechSynthesis.getVoices();
      utterance.voice = voices.find((voice) => /robot|google.*english|english/i.test(voice.name)) || null;
      utterance.rate = 1.1;
      utterance.pitch = 0.6;
      window.speechSynthesis.speak(utterance);
      return () => window.speechSynthesis.cancel();
    }

    // A soft local oscillator supplies short speech-like ticks when the browser has no voice engine.
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return undefined;
      audioContext.current ||= new AudioContextClass();
      const context = audioContext.current;
      const chars = [...message.text].filter((character, index) => /[a-z]/i.test(character) && index % 3 === 0).slice(0, 32);
      chars.forEach((_, index) => {
        const when = context.currentTime + index * 0.045;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'square';
        oscillator.frequency.value = 220 + ((index * 53) % 210);
        gain.gain.setValueAtTime(0.0001, when);
        gain.gain.exponentialRampToValueAtTime(0.025, when + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.035);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(when);
        oscillator.stop(when + 0.04);
      });
    } catch {}
    return undefined;
  }, [message?.at, message?.text, soundOn, audioReady, alreadySpoken]);

  useEffect(() => () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    audioContext.current?.close().catch(() => {});
  }, []);

  if (!message?.text || !visible) return null;
  return (
    <Html position={[0, 3.02, 0]} center distanceFactor={7.5} zIndexRange={[30, 0]}>
      <div className="archie-speech" role="status" aria-live="polite">
        <span className="speech-speaker">A.R.C.H.I.E.</span>
        <span>{shown}<i className="speech-caret">▌</i></span>
      </div>
    </Html>
  );
}
