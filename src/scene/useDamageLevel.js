import { useEffect, useState } from 'react';

const clampProgress = (value) => Math.max(0, Math.min(99.9, Number(value) || 0));
const stageAt = (value) => value < 20 ? 0 : value < 40 ? 1 : value < 60 ? 2 : value < 80 ? 3 : 4;

// Damage never heals during this mounted session, even if a market estimate dips.
export default function useDamageLevel(progress = 0, graduated = false, preview = false) {
  const [maximum, setMaximum] = useState(() => clampProgress(progress));
  useEffect(() => {
    const current = clampProgress(progress);
    setMaximum((previous) => preview ? current : Math.max(previous, current));
  }, [progress, preview]);
  const current = preview ? clampProgress(progress) : maximum;
  return {
    stage: graduated ? 5 : stageAt(current),
    progress: current,
    graduated: Boolean(graduated),
  };
}
