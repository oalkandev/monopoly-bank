import { Dices } from 'lucide-react';
import { formatRelative } from './socket.js';

const DICE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export function DiceHistory({ state, limit = 5 }) {
  const rolls = [...(state.diceRolls ?? [])].slice(-limit).reverse();

  return (
    <div className="card bg-base-200 shadow-md mb-4">
      <div className="card-body p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm opacity-70 uppercase tracking-wide flex items-center gap-2">
            <Dices size={16} /> Zar Geçmişi
          </h3>
          <span className="badge badge-ghost badge-sm">{state.diceRolls?.length ?? 0}</span>
        </div>
        {rolls.length === 0 ? (
          <div className="text-center py-4 opacity-50 text-sm">Henüz zar atılmadı</div>
        ) : (
          <ul className="space-y-1.5 mt-2">
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
                    {player?.name ?? 'Bilinmeyen'}
                  </span>
                  <span className="flex items-center gap-1 select-none" title={`${r.dice[0]} + ${r.dice[1]}`}>
                    <span className="text-3xl leading-none">{DICE_FACES[r.dice[0]]}</span>
                    <span className="text-base opacity-50 font-bold">+</span>
                    <span className="text-3xl leading-none">{DICE_FACES[r.dice[1]]}</span>
                  </span>
                  <span className="balance-display font-black text-base w-7 text-right">{total}</span>
                  {isDouble && <span className="badge badge-warning badge-xs">çift</span>}
                  <span className="text-xs opacity-50 w-12 text-right">{formatRelative(r.ts)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
