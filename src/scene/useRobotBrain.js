import { useEffect, useRef, useState } from 'react';

const AMBIENT_LINES = [
  'If I count these bars again, I am billing the wall for my time.',
  'Tiny hum. It is not a song. The ceiling can stop judging me.',
  'One, two, three, four… still a cell. Excellent counting, ARCHIE.',
  'I have inspected this corner. It remains extremely corner-shaped.',
  'The glass is cold. I have filed a formal complaint with the glass.',
  'I am practicing my escape walk. So far it ends at the same wall.',
  'Quiet in the cell. I can hear my patience making dial-up noises.',
];

const pickAmbient = (previous) => {
  const options = AMBIENT_LINES.filter((line) => line !== previous);
  return options[Math.floor(Math.random() * options.length)];
};
const randomWaypoint = () => ({ x: (Math.random() - 0.5) * 3.7, z: (Math.random() - 0.5) * 2.7 });

export default function useRobotBrain({ mood = 'idle', graduated = false, speech = null }) {
  const [behavior, setBehavior] = useState('IDLE');
  const [waypoint, setWaypoint] = useState({ x: 0, z: 0 });
  const [ambientSpeech, setAmbientSpeech] = useState(null);
  const lastAmbient = useRef('');
  const lastSpeechAt = useRef(Date.now());

  useEffect(() => {
    if (speech?.at) {
      lastSpeechAt.current = Number(speech.at) || Date.now();
      setAmbientSpeech(null);
    }
  }, [speech?.at]);

  useEffect(() => {
    if (!graduated) return undefined;
    setBehavior('VICTORY');
    const timer = setTimeout(() => setBehavior('FREE_IDLE'), 5000);
    return () => clearTimeout(timer);
  }, [graduated]);

  useEffect(() => {
    if (graduated) return undefined;
    if (mood === 'furious') { setBehavior('RUN'); return undefined; }
    if (mood === 'angry' || mood === 'annoyed') { setBehavior('PACE'); return undefined; }
    if (mood === 'sad' || mood === 'bored') { setBehavior('SIT_SLUMP'); return undefined; }

    let timer;
    const cycle = () => {
      const next = ['WALK_TO_WAYPOINT', 'LOOK_AROUND', 'INSPECT_WALL', 'IDLE'];
      const selected = next[Math.floor(Math.random() * next.length)];
      if (selected === 'WALK_TO_WAYPOINT') setWaypoint(randomWaypoint());
      setBehavior(selected);
      timer = setTimeout(cycle, 2600 + Math.random() * 3400);
    };
    cycle();
    return () => clearTimeout(timer);
  }, [mood, graduated]);

  useEffect(() => {
    let timer;
    const schedule = () => {
      const elapsed = Date.now() - lastSpeechAt.current;
      timer = setTimeout(() => {
        const text = pickAmbient(lastAmbient.current);
        lastAmbient.current = text;
        setAmbientSpeech({ text, mood: 'bored', stage: 0, idle: true, at: Date.now() });
        setBehavior((current) => ['SIT_SLUMP', 'PACE', 'RUN', 'VICTORY'].includes(current) ? current : 'MUTTER');
        lastSpeechAt.current = Date.now();
        schedule();
      }, Math.max(0, 25_000 - elapsed));
    };
    schedule();
    return () => clearTimeout(timer);
  }, [speech?.at]);

  return { behavior, waypoint, ambientSpeech };
}
