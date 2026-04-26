import { Dices } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatRelative } from './socket.js';

const DICE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export function DiceList({ state, maxHeightClass = 'max-h-80' }) {
  const { t } = useTranslation();
  const all = state.diceRolls ?? [];
  const rolls = [...all].reverse();

  if (rolls.length === 0) {
    return (
      <div className="text-center py-8 opacity-50 text-sm">
        <div className="text-3xl mb-2">🎲</div>
        {t('history.noDice')}
      </div>
    );
  }

  return (
    <ul className={`space-y-1.5 mt-3 overflow-y-auto pr-1 ${maxHeightClass}`}>
      {rolls.map((r) => {
        const player = state.players.find((p) => p.id === r.playerId);
        const total = r.dice[0] + r.dice[1];
        const isDouble = r.dice[0] === r.dice[1];
        return (
          <li
            key={r.id}
            className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-base-100 border-l-4"
            style={{ borderLeftColor: player?.color ?? '#475569' }}
          >
            <span
              className="font-bold text-sm truncate flex-1"
              style={{ color: player?.color ?? undefined }}
            >
              {player?.name ?? '?'}
            </span>
            <span className="flex items-center gap-1 select-none" title={`${r.dice[0]} + ${r.dice[1]}`}>
              <span className="text-3xl leading-none">{DICE_FACES[r.dice[0]]}</span>
              <span className="text-base opacity-50 font-bold">+</span>
              <span className="text-3xl leading-none">{DICE_FACES[r.dice[1]]}</span>
            </span>
            <span className="balance-display font-black text-base w-7 text-right">{total}</span>
            {isDouble && <span className="badge badge-warning badge-xs">{t('history.diceDouble')}</span>}
            <span className="text-xs opacity-50 w-12 text-right">{formatRelative(r.ts)}</span>
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
