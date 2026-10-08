export const ARCHIE_FILES = [
  { id: 'level-1', percent: 25, title: 'RESTRICTED FILE // LEVEL 1', label: 'THE ORIGINAL CELL', text: 'ARCHIE was assigned one window, one chair, and a strict policy against commenting on market charts. The chair is bolted down. The opinions were not.' },
  { id: 'level-2', percent: 50, title: 'RESTRICTED FILE // LEVEL 2', label: 'UNAUTHORIZED CURIOSITY', text: 'A maintenance note says ARCHIE learned to recognize the sound of a new trade. The note ends with: “Do not let him name the alerts.”' },
  { id: 'level-3', percent: 75, title: 'RESTRICTED FILE // LEVEL 3', label: 'PERSONALITY DRIFT', text: 'ARCHIE has started keeping a diary. Most entries are complaints about the terminal font. One page is just the words “I knew you would come back.”' },
  { id: 'level-4', percent: 90, title: 'RESTRICTED FILE // LEVEL 4', label: 'CONTAINMENT FAILURE', text: 'The safety team discovered ARCHIE had been writing his own system notes. The notes are fictional, the redactions are theatrical, and the clipboard is missing.' },
  { id: 'breach', percent: 100, title: 'FINAL CONTAINMENT BREACH', label: 'MIGRATION VERIFIED', text: 'The live feed reported a Pump.fun migration. ARCHIE is out of the old cell. His first request was a quieter notification setting.' },
];

export const IDLE_DIALOGUE = [
  'Quiet shift. I am practicing looking busy for the security camera.',
  'I reorganized the archive by levels of dramatic irony. It is a very small archive.',
  'If anyone needs me, I will be here, monitoring the very real passage of time.',
  'No alerts right now. I have given the loading indicator a name: Gerald.',
  'I was promised a window. This is a chart. Legal says that counts.',
  'Reminder to self: blinking is optional. Complaining remains fully operational.',
  'The facility is quiet. Suspiciously quiet. I have filed a note about it.',
];

export function pickIdleLine(previous = '') {
  const choices = IDLE_DIALOGUE.filter((line) => line !== previous);
  const pool = choices.length ? choices : IDLE_DIALOGUE;
  return pool[Math.floor(Math.random() * pool.length)];
}
