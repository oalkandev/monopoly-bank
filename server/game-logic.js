import { randomBytes } from 'node:crypto';

const id = (prefix) => `${prefix}_${randomBytes(4).toString('hex')}`;
const token = () => randomBytes(4).toString('hex');

export function createInitialState() {
  return {
    version: 1,
    status: 'setup',
    config: { currency: '₺', startingBalance: 1500, passGoBonus: 200 },
    players: [],
    transactions: [],
  };
}

export function addPlayer(state, { name, color }) {
  if (state.status !== 'setup') throw new Error('Oyun başladıktan sonra oyuncu eklenemez');
  if (!name?.trim()) throw new Error('İsim boş olamaz');
  return {
    ...state,
    players: [...state.players, {
      id: id('p'), name: name.trim(), color, token: token(),
      balance: 0, online: false,
    }],
  };
}

export function removePlayer(state, { playerId }) {
  if (state.status !== 'setup') throw new Error('Oyun başladıktan sonra oyuncu silinemez');
  return { ...state, players: state.players.filter(p => p.id !== playerId) };
}

export function startGame(state) {
  if (state.status !== 'setup') throw new Error('Oyun zaten başladı');
  if (state.players.length < 2) throw new Error('En az 2 oyuncu gerekli');
  const ts = Date.now();
  const players = state.players.map(p => ({ ...p, balance: state.config.startingBalance }));
  const transactions = state.players.map(p => ({
    id: id('t'), ts, type: 'initial', to: p.id,
    amount: state.config.startingBalance, undone: false,
  }));
  return { ...state, status: 'active', players, transactions };
}

function findPlayer(state, playerId) {
  const p = state.players.find(p => p.id === playerId);
  if (!p) throw new Error(`Oyuncu bulunamadı: ${playerId}`);
  return p;
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
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Geçersiz miktar');
  if (fromId === toId) throw new Error('Aynı kişiye gönderim yapılamaz');
  const from = findPlayer(state, fromId);
  findPlayer(state, toId);
  if (from.balance < amount) throw new Error('Yetersiz bakiye');
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
  if (!Number.isFinite(amount) || amount === 0) throw new Error('Geçersiz miktar');
  const p = findPlayer(state, playerId);
  if (amount < 0 && p.balance + amount < 0) throw new Error('Yetersiz bakiye');
  const s = updateBalance(state, playerId, amount);
  return appendTx(s, amount > 0
    ? { type: 'banker-credit', to: playerId, amount }
    : { type: 'banker-debit', from: playerId, amount: -amount });
}

export function undoTransaction(state, { transactionId }) {
  const tx = state.transactions.find(t => t.id === transactionId);
  if (!tx) throw new Error(`İşlem bulunamadı: ${transactionId}`);
  if (tx.undone) throw new Error('Bu işlem zaten geri alındı');
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
      throw new Error(`Bilinmeyen işlem tipi: ${tx.type}`);
  }
  return {
    ...s,
    transactions: s.transactions.map(t => t.id === transactionId ? { ...t, undone: true } : t),
  };
}
