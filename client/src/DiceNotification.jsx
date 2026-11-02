import { useEffect, useRef, useState } from 'react';
import { Dices } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ROLL_DURATION_MS = 2000;
const ROLL_TICK_MS = 70;
const RESULT_VISIBLE_MS = 3300;

const DOT_PATTERNS = {
  1: [[30, 30]],
  2: [[15, 15], [45, 45]],
  3: [[15, 15], [30, 30], [45, 45]],
  4: [[15, 15], [45, 15], [15, 45], [45, 45]],
  5: [[15, 15], [45, 15], [30, 30], [15, 45], [45, 45]],
  6: [[15, 15], [45, 15], [15, 30], [45, 30], [15, 45], [45, 45]],
};

function DieFace({ value, dotColor = '#1e293b' }) {
  const dots = DOT_PATTERNS[value] ?? [];
  return (
    <svg viewBox="0 0 60 60" className="w-full h-full block">
      {dots.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={6} fill={dotColor} />
      ))}
    </svg>
  );
}

function AnimatedDie({ finalValue, rollKey, dotColor }) {
  const [face, setFace] = useState(() => 1 + Math.floor(Math.random() * 6));
  const [bouncing, setBouncing] = useState(false);

  useEffect(() => {
    setBouncing(true);
    const interval = setInterval(() => {
      setFace(1 + Math.floor(Math.random() * 6));
    }, ROLL_TICK_MS);
    const stop = setTimeout(() => {
      clearInterval(interval);
      setFace(finalValue);
      setBouncing(false);
    }, ROLL_DURATION_MS);
    return () => {
      clearInterval(interval);
      clearTimeout(stop);
    };
  }, [rollKey, finalValue]);

  return (
    <div
      className={`w-24 h-24 bg-white rounded-2xl shadow-inner p-3 ${bouncing ? 'die-rolling' : ''}`}
    >
      <DieFace value={face} dotColor={dotColor} />
    </div>
  );
}

export function DiceNotification({ roll, players, onClose }) {
  const { t } = useTranslation();

  // onClose her render'da yeni fonksiyon olabilir; sayaç yalnızca yeni zarda yeniden başlamalı
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const rollKey = roll?.key ?? roll?.ts;
  const [settledKey, setSettledKey] = useState(null);

  useEffect(() => {
    if (!roll) return;
    const settle = setTimeout(() => setSettledKey(rollKey), ROLL_DURATION_MS);
    const close = setTimeout(() => onCloseRef.current(), ROLL_DURATION_MS + RESULT_VISIBLE_MS);
    return () => {
      clearTimeout(settle);
      clearTimeout(close);
    };
  }, [roll]);

  if (!roll) return null;
  const settled = settledKey === rollKey;
  const player = players.find((p) => p.id === roll.playerId);
  const total = roll.dice[0] + roll.dice[1];
  const isDouble = roll.dice[0] === roll.dice[1];
  const color = player?.color ?? '#475569';

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-6 cursor-pointer modal-fade-in backdrop-blur-md"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        className="rounded-3xl p-8 shadow-2xl border-4 max-w-sm w-full text-center"
        style={{ borderColor: color, background: `linear-gradient(135deg, ${color}, ${shade(color, -0.25)})` }}
      >
        <div className="flex items-center justify-center gap-2 text-white/90 text-sm font-bold uppercase tracking-wider mb-2">
          <Dices size={20} />
          <span>{t('dice.rolledTitle')}</span>
        </div>
        <div data-testid="dice-player" className="text-2xl font-black text-white mb-4 drop-shadow">
          {player?.name ?? '?'}
        </div>
        <div className="flex items-center justify-center gap-4 my-4">
          <AnimatedDie key={rollKey + '-a'} finalValue={roll.dice[0]} rollKey={rollKey + '-a'} dotColor={color} />
          <span className="text-5xl text-white/60 font-light">+</span>
          <AnimatedDie key={rollKey + '-b'} finalValue={roll.dice[1]} rollKey={rollKey + '-b'} dotColor={color} />
        </div>
        <div className="mt-4 text-white">
          <div className="text-xs uppercase tracking-wider opacity-75 font-bold">{t('dice.total')}</div>
          <div data-testid="dice-total" className="balance-display text-6xl font-black drop-shadow leading-none mt-1">
            {settled ? total : '?'}
          </div>
          {isDouble && (
            <div className={`mt-3 inline-block px-3 py-1 bg-white/20 rounded-full text-sm font-bold ${settled ? '' : 'invisible'}`}>
              {t('dice.double')}
            </div>
          )}
        </div>
        <div className="mt-5 text-xs text-white/60">{t('dice.tapToClose')}</div>
      </div>
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
