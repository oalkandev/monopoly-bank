import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  addPlayer,
  startGame,
  applyTransfer,
  applyBankerAdjust,
  applyPassGo,
  undoTransaction,
} from '../server/game-logic.js';

function setup() {
  let s = createInitialState();
  s = addPlayer(s, { name: 'A', color: '#f00' });
  s = addPlayer(s, { name: 'B', color: '#00f' });
  return startGame(s);
}

test('createInitialState varsayılanlarla başlar', () => {
  const s = createInitialState();
  assert.equal(s.status, 'setup');
  assert.equal(s.config.startingBalance, 1500);
  assert.equal(s.config.passGoBonus, 200);
  assert.deepEqual(s.players, []);
  assert.deepEqual(s.transactions, []);
});

test('addPlayer oyuncu ekler ve token atar', () => {
  let s = createInitialState();
  s = addPlayer(s, { name: 'Ahmet', color: '#e53935' });
  assert.equal(s.players.length, 1);
  assert.equal(s.players[0].name, 'Ahmet');
  assert.equal(s.players[0].balance, 0);
  assert.ok(s.players[0].id);
  assert.ok(s.players[0].token);
});

test('startGame her oyuncuya başlangıç parası verir', () => {
  const s = setup();
  assert.equal(s.status, 'active');
  assert.equal(s.players[0].balance, 1500);
  assert.equal(s.players[1].balance, 1500);
  assert.equal(s.transactions.length, 2);
  assert.equal(s.transactions[0].type, 'initial');
});

test('startGame özel başlangıç parası kullanır', () => {
  let s = createInitialState();
  s = addPlayer(s, { name: 'A', color: '#f00' });
  s = addPlayer(s, { name: 'B', color: '#00f' });
  s.config.startingBalance = 1000;
  s = startGame(s);
  assert.equal(s.players[0].balance, 1000);
  assert.equal(s.players[1].balance, 1000);
});

test('startGame 2 oyuncudan az ile reddeder', () => {
  let s = createInitialState();
  s = addPlayer(s, { name: 'A', color: '#f00' });
  assert.throws(() => startGame(s), /errors\.minTwoPlayers/);
});

test('applyTransfer bakiyeleri günceller', () => {
  let s = setup();
  const [a, b] = s.players;
  s = applyTransfer(s, { fromId: a.id, toId: b.id, amount: 200 });
  assert.equal(s.players[0].balance, 1300);
  assert.equal(s.players[1].balance, 1700);
  assert.equal(s.transactions.at(-1).type, 'transfer');
});

test('applyTransfer yetersiz bakiyede hata atar', () => {
  const s = setup();
  const [a, b] = s.players;
  assert.throws(
    () => applyTransfer(s, { fromId: a.id, toId: b.id, amount: 9999 }),
    /errors\.insufficientBalance/
  );
});

test('applyTransfer geçersiz miktarı reddeder', () => {
  const s = setup();
  const [a, b] = s.players;
  assert.throws(() => applyTransfer(s, { fromId: a.id, toId: b.id, amount: 0 }), /errors\.invalidAmount/);
  assert.throws(() => applyTransfer(s, { fromId: a.id, toId: b.id, amount: -10 }), /errors\.invalidAmount/);
  assert.throws(() => applyTransfer(s, { fromId: a.id, toId: b.id, amount: NaN }), /errors\.invalidAmount/);
});

test('applyTransfer aynı kişiye gönderimi reddeder', () => {
  const s = setup();
  const [a] = s.players;
  assert.throws(() => applyTransfer(s, { fromId: a.id, toId: a.id, amount: 10 }), /errors\.transferSelf/);
});

test('applyPassGo bonus ekler', () => {
  let s = setup();
  const [a] = s.players;
  s = applyPassGo(s, { playerId: a.id });
  assert.equal(s.players[0].balance, 1700);
  assert.equal(s.transactions.at(-1).type, 'pass-go');
});

test('applyBankerAdjust pozitif → kredi, negatif → borç', () => {
  let s = setup();
  const [a] = s.players;
  s = applyBankerAdjust(s, { playerId: a.id, amount: 500 });
  assert.equal(s.players[0].balance, 2000);
  assert.equal(s.transactions.at(-1).type, 'banker-credit');
  s = applyBankerAdjust(s, { playerId: a.id, amount: -300 });
  assert.equal(s.players[0].balance, 1700);
  assert.equal(s.transactions.at(-1).type, 'banker-debit');
});

test('applyBankerAdjust bakiye eksiye düşmesini engeller', () => {
  const s = setup();
  const [a] = s.players;
  assert.throws(
    () => applyBankerAdjust(s, { playerId: a.id, amount: -2000 }),
    /errors\.insufficientBalance/
  );
});

test('undoTransaction transferi tersine çevirir', () => {
  let s = setup();
  const [a, b] = s.players;
  s = applyTransfer(s, { fromId: a.id, toId: b.id, amount: 200 });
  const txId = s.transactions.at(-1).id;
  s = undoTransaction(s, { transactionId: txId });
  assert.equal(s.players[0].balance, 1500);
  assert.equal(s.players[1].balance, 1500);
  assert.equal(s.transactions.find(t => t.id === txId).undone, true);
});

test('undoTransaction iki kez aynı işlemi geri alamaz', () => {
  let s = setup();
  const [a, b] = s.players;
  s = applyTransfer(s, { fromId: a.id, toId: b.id, amount: 200 });
  const txId = s.transactions.at(-1).id;
  s = undoTransaction(s, { transactionId: txId });
  assert.throws(() => undoTransaction(s, { transactionId: txId }), /errors\.alreadyUndone/);
});

test('undoTransaction pass-go işlemini geri alır', () => {
  let s = setup();
  const [a] = s.players;
  s = applyPassGo(s, { playerId: a.id });
  const txId = s.transactions.at(-1).id;
  s = undoTransaction(s, { transactionId: txId });
  assert.equal(s.players[0].balance, 1500);
});
