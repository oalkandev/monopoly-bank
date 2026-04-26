import { useEffect } from 'react';
import { Dices } from 'lucide-react';

const DICE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export function DiceNotification({ roll, players, onClose }) {
  useEffect(() => {
    if (!roll) return;
    const id = setTimeout(onClose, 3500);
    return () => clearTimeout(id);
  }, [roll, onClose]);

  if (!roll) return null;
  const player = players.find((p) => p.id === roll.playerId);
  const total = roll.dice[0] + roll.dice[1];
  const isDouble = roll.dice[0] === roll.dice[1];
  const color = player?.color ?? '#475569';

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-6 cursor-pointer modal-fade-in"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        className="rounded-3xl p-8 shadow-2xl border-4 max-w-sm w-full text-center"
        style={{ borderColor: color, background: `linear-gradient(135deg, ${color}, ${shade(color, -0.25)})` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center gap-2 text-white/90 text-sm font-bold uppercase tracking-wider mb-2">
          <Dices size={20} />
          <span>Zar Atıldı</span>
        </div>
        <div className="text-2xl font-black text-white mb-4 drop-shadow">
          {player?.name ?? 'Bilinmeyen'}
        </div>
        <div className="flex items-center justify-center gap-4 my-4">
          <DieFace value={roll.dice[0]} />
          <span className="text-5xl text-white/60 font-light">+</span>
          <DieFace value={roll.dice[1]} />
        </div>
        <div className="mt-4 text-white">
          <div className="text-xs uppercase tracking-wider opacity-75 font-bold">Toplam</div>
          <div className="balance-display text-6xl font-black drop-shadow leading-none mt-1">
            {total}
          </div>
          {isDouble && (
            <div className="mt-3 inline-block px-3 py-1 bg-white/20 rounded-full text-sm font-bold">
              🎉 Çift! Bir kez daha at
            </div>
          )}
        </div>
        <div className="mt-5 text-xs text-white/60">kapatmak için dokun</div>
      </div>
    </div>
  );
}

function DieFace({ value }) {
  return (
    <div
      className="w-24 h-24 bg-white rounded-2xl shadow-inner flex items-center justify-center text-7xl font-black text-slate-900 select-none"
      style={{ lineHeight: 1 }}
    >
      {DICE_FACES[value]}
    </div>
  );
}

function shade(hex, percent) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 0xff;
  let g = (n >> 8) & 0xff;
  let b = n & 0xff;
  const adj = (c) => Math.max(0, Math.min(255, Math.round(c + 255 * percent)));
  r = adj(r); g = adj(g); b = adj(b);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
