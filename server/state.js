import * as logic from './game-logic.js';
import * as persistence from './persistence.js';

let state = logic.createInitialState();
const listeners = new Set();

export async function init() {
  const loaded = await persistence.load();
  if (loaded) state = loaded;
}

export function get() { return state; }

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

async function commit(next) {
  state = next;
  await persistence.save(state);
  for (const fn of listeners) fn(state);
}

export async function reset() {
  await commit(logic.createInitialState());
}

export async function addPlayer(payload) {
  await commit(logic.addPlayer(state, payload));
}

export async function addDiceRoll(roll) {
  const existing = state.diceRolls ?? [];
  const next = [...existing, roll].slice(-50);
  await commit({ ...state, diceRolls: next });
}

export async function removePlayer(payload) {
  await commit(logic.removePlayer(state, payload));
}

export async function renamePlayer(payload) {
  await commit(logic.renamePlayer(state, payload));
}

export async function startGame(config) {
  if (config) state = { ...state, config: { ...state.config, ...config } };
  await commit(logic.startGame(state));
}

export async function updateConfig(patch) {
  const allowed = {};
  if (Number.isFinite(patch?.passGoBonus) && patch.passGoBonus >= 0) allowed.passGoBonus = patch.passGoBonus;
  if (Number.isFinite(patch?.startingBalance) && patch.startingBalance > 0) allowed.startingBalance = patch.startingBalance;
  if (typeof patch?.currency === 'string' && patch.currency.length <= 5) allowed.currency = patch.currency;
  if (Array.isArray(patch?.quickAmounts)) {
    const cleaned = [...new Set(
      patch.quickAmounts
        .map(Number)
        .filter(n => Number.isFinite(n) && n > 0)
        .map(n => Math.floor(n))
    )].sort((a, b) => a - b);
    if (cleaned.length > 0 && cleaned.length <= 12) allowed.quickAmounts = cleaned;
  }
  await commit({ ...state, config: { ...state.config, ...allowed } });
}

export async function payToBank(payload) {
  const { playerId, amount } = payload;
  logic.assertValidAmount(amount);
  if (amount <= 0) throw new Error('errors.invalidAmount');
  await commit(logic.applyBankerAdjust(state, { playerId, amount: -amount }));
}

export async function transfer(payload) { await commit(logic.applyTransfer(state, payload)); }
export async function passGo(payload) { await commit(logic.applyPassGo(state, payload)); }
export async function bankerAdjust(payload) { await commit(logic.applyBankerAdjust(state, payload)); }
export async function undo(payload) { await commit(logic.undoTransaction(state, payload)); }

export function setOnline(playerId, online) {
  const players = state.players.map(p => p.id === playerId ? { ...p, online } : p);
  state = { ...state, players };
  for (const fn of listeners) fn(state);
}

export function findByToken(token) {
  return state.players.find(p => p.token === token) ?? null;
}
