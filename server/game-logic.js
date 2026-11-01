import { randomBytes } from 'node:crypto';

const id = (prefix) => `${prefix}_${randomBytes(4).toString('hex')}`;
const token = () => randomBytes(4).toString('hex');

export const DEFAULT_QUICK_AMOUNTS = [1, 5, 10, 50, 100, 500];
export const MAX_NAME_LENGTH = 24;

export function createInitialState() {
  return {
    version: 1,
    status: 'setup',
    config: {
      currency: '₺',
      startingBalance: 1500,
      passGoBonus: 200,
      quickAmounts: [...DEFAULT_QUICK_AMOUNTS],
    },
    players: [],
    transactions: [],
    diceRolls: [],
  };
}

export function addPlayer(state, { name, color }) {
  if (state.status !== 'setup') throw new Error('errors.playerAfterStart');
  const trimmed = validateName(state, name);
  return {
    ...state,
    players: [...state.players, {
      id: id('p'), name: trimmed, color, token: token(),
      balance: 0, online: false,
    }],
  };
}

export function removePlayer(state, { playerId }) {
  if (state.status !== 'setup') throw new Error('errors.removePlayerAfterStart');
  return { ...state, players: state.players.filter(p => p.id !== playerId) };
}

export function renamePlayer(state, { playerId, name }) {
  findPlayer(state, playerId);
  const trimmed = validateName(state, name, playerId);
  return {
    ...state,
    players: state.players.map(p =>
      p.id === playerId ? { ...p, name: trimmed } : p
    ),
  };
}

export function startGame(state) {
  if (state.status !== 'setup') throw new Error('errors.gameAlreadyStarted');
  if (state.players.length < 2) throw new Error('errors.minTwoPlayers');
  const ts = Date.now();
  const players = state.players.map(p => ({ ...p, balance: state.config.startingBalance }));
  const transactions = state.players.map(p => ({
    id: id('t'), ts, type: 'initial', to: p.id,
    amount: state.config.startingBalance, undone: false,
  }));
  return { ...state, status: 'active', startedAt: ts, players, transactions };
}

function findPlayer(state, playerId) {
  const p = state.players.find(p => p.id === playerId);
  if (!p) throw new Error('errors.playerNotFound');
  return p;
}

function validateName(state, name, playerId) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) throw new Error('errors.nameEmpty');
  if (trimmed.length > MAX_NAME_LENGTH) throw new Error('errors.nameTooLong');
  const taken = state.players.some(p =>
    p.id !== playerId && p.name.localeCompare(trimmed, undefined, { sensitivity: 'accent' }) === 0
  );
  if (taken) throw new Error('errors.nameTaken');
  return trimmed;
}

function updateBalance(state, playerId, delta) {
  return {
    ...state,
    players: state.players.map(p =>
      p.id === playerId ? { ...p, balance: p.balance + delta } : p
    ),
  };
}

function appendTx(state, tx) {
  return {
    ...state,
    transactions: [...state.transactions, { id: id('t'), ts: Date.now(), undone: false, ...tx }],
  };
}

export function applyTransfer(state, { fromId, toId, amount }) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('errors.invalidAmount');
  if (fromId === toId) throw new Error('errors.transferSelf');
  const from = findPlayer(state, fromId);
  findPlayer(state, toId);
  if (from.balance < amount) throw new Error('errors.insufficientBalance');
  let s = updateBalance(state, fromId, -amount);
  s = updateBalance(s, toId, amount);
  return appendTx(s, { type: 'transfer', from: fromId, to: toId, amount });
}

export function applyPassGo(state, { playerId }) {
  findPlayer(state, playerId);
  const bonus = state.config.passGoBonus;
  const s = updateBalance(state, playerId, bonus);
  return appendTx(s, { type: 'pass-go', to: playerId, amount: bonus });
}

export function applyBankerAdjust(state, { playerId, amount }) {
  if (!Number.isFinite(amount) || amount === 0) throw new Error('errors.invalidAmount');
  const p = findPlayer(state, playerId);
  if (amount < 0 && p.balance + amount < 0) throw new Error('errors.insufficientBalance');
  const s = updateBalance(state, playerId, amount);
  return appendTx(s, amount > 0
    ? { type: 'banker-credit', to: playerId, amount }
    : { type: 'banker-debit', from: playerId, amount: -amount });
}

export function undoTransaction(state, { transactionId }) {
  const tx = state.transactions.find(t => t.id === transactionId);
  if (!tx) throw new Error('errors.txNotFound');
  if (tx.undone) throw new Error('errors.alreadyUndone');
  let s = state;
  switch (tx.type) {
    case 'transfer':
      s = updateBalance(s, tx.from, tx.amount);
      s = updateBalance(s, tx.to, -tx.amount);
      break;
    case 'pass-go':
    case 'banker-credit':
    case 'initial':
      s = updateBalance(s, tx.to, -tx.amount);
      break;
    case 'banker-debit':
      s = updateBalance(s, tx.from, tx.amount);
      break;
    default:
      throw new Error('errors.unknownError');
  }
  return {
    ...s,
    transactions: s.transactions.map(t => t.id === transactionId ? { ...t, undone: true } : t),
  };
}
