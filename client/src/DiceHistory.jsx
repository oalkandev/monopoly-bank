import { Dices } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatRelative } from './socket.js';

const DICE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

// Boyuta göre class'lar; normal set oyuncunun telefon ekranında kullanılır
const DICE_SIZES = {
  normal: {
    list: 'space-y-1.5', row: 'gap-2 py-1.5 px-2', name: 'text-sm', face: 'text-3xl', plus: 'text-base',
    total: 'text-base w-7', badge: 'badge-xs', time: 'text-xs w-12', empty: 'text-sm',
  },
  large: {
    list: 'space-y-2', row: 'gap-4 py-3 px-4', name: 'text-2xl', face: 'text-6xl', plus: 'text-2xl',
    total: 'text-4xl w-14', badge: 'badge-lg', time: 'text-base w-24', empty: 'text-base',
  },
};

export function DiceList({ state, maxHeightClass = 'max-h-80', large = false }) {
  const { t } = useTranslation();
  const sz = large ? DICE_SIZES.large : DICE_SIZES.normal;
  const all = state.diceRolls ?? [];
  const rolls = [...all].reverse();

  if (rolls.length === 0) {
    return (
      <div className={`text-center py-8 opacity-50 ${sz.empty}`}>
        <div className="text-3xl mb-2">🎲</div>
        {t('history.noDice')}
      </div>
    );
  }

  return (
    <ul className={`${sz.list} mt-3 overflow-y-auto pr-1 ${maxHeightClass}`}>
      {rolls.map((r) => {
        const player = state.players.find((p) => p.id === r.playerId);
        const total = r.dice[0] + r.dice[1];
        const isDouble = r.dice[0] === r.dice[1];
        return (
          <li
            key={r.id}
            className={`flex items-center ${sz.row} rounded-lg bg-base-100 border-l-4`}
            style={{ borderLeftColor: player?.color ?? '#475569' }}
          >
            <span className="flex items-center gap-2 flex-1 min-w-0">
              <span
                className={`font-bold ${sz.name} truncate`}
                style={{ color: player?.color ?? undefined }}
              >
                {player?.name ?? '?'}
              </span>
              {isDouble && <span className={`badge badge-warning ${sz.badge} shrink-0`}>{t('history.diceDouble')}</span>}
            </span>
            <span className="flex items-center gap-1 select-none shrink-0" title={`${r.dice[0]} + ${r.dice[1]}`}>
              <span className={`${sz.face} leading-none`}>{DICE_FACES[r.dice[0]]}</span>
              <span className={`${sz.plus} opacity-50 font-bold`}>+</span>
              <span className={`${sz.face} leading-none`}>{DICE_FACES[r.dice[1]]}</span>
            </span>
            <span className={`balance-display font-black ${sz.total} text-right`}>{total}</span>
            <span className={`${sz.time} opacity-50 text-right`}>{formatRelative(r.ts)}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function DiceHistory({ state }) {
  const { t } = useTranslation();
  const count = state.diceRolls?.length ?? 0;
  return (
    <div className="card bg-base-200 shadow-md mb-4">
      <div className="card-body p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm opacity-70 uppercase tracking-wide flex items-center gap-2">
            <Dices size={16} /> {t('history.diceHistory')}
          </h3>
          <span className="badge badge-ghost badge-sm">{count}</span>
        </div>
        <DiceList state={state} />
      </div>
    </div>
  );
}
