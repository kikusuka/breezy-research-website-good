import { useEffect, useState } from 'react';
export function useElapsed(startedAt: number | null, active: boolean) {
  const [, tick] = useState(0);
  useEffect(() => { if (!active) return; const id = window.setInterval(() => tick((t) => t + 1), 1000); return () => window.clearInterval(id); }, [active]);
  if (!startedAt || !active) return null;
  const sec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  return `${Math.floor(sec / 60).toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`;
}
