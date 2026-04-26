import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

export function GameTimer({ startedAt, size = 'md' }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const totalSec = Math.max(0, Math.floor((now - startedAt) / 1000));
  const hh = Math.floor(totalSec / 3600);
  const mm = Math.floor((totalSec % 3600) / 60);
  const ss = totalSec % 60;
  const text = hh > 0
    ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
    : `${mm}:${String(ss).padStart(2, '0')}`;

  const iconSize = size === 'sm' ? 12 : 14;
  const padding = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1';

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${padding} rounded-full bg-base-300/60 text-xs font-medium balance-display`}
      title="Oyun süresi"
    >
      <Clock size={iconSize} className="opacity-80" />
      <span>{text}</span>
    </div>
  );
}
