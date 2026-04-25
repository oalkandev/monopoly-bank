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

export async function removePlayer(payload) {
  await commit(logic.removePlayer(state, payload));
}

export async function startGame(config) {
  if (config) state = { ...state, config: { ...state.config, ...config } };
  await commit(logic.startGame(state));
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
