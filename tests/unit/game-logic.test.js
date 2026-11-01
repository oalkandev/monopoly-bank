import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  addPlayer,
  renamePlayer,
  startGame,
  applyTransfer,
  applyBankerAdjust,
  applyPassGo,
  undoTransaction,
  MAX_NAME_LENGTH,
} from '../../server/game-logic.js';

function setup() {
  let s = createInitialState();
  s = addPlayer(s, { name: 'A', color: '#f00' });
  s = addPlayer(s, { name: 'B', color: '#00f' });
  return startGame(s);
}

test('createInitialState starts with the defaults', () => {
  const s = createInitialState();
  assert.equal(s.status, 'setup');
  assert.equal(s.config.startingBalance, 1500);
  assert.equal(s.config.passGoBonus, 200);
  assert.deepEqual(s.players, []);
  assert.deepEqual(s.transactions, []);
});

test('addPlayer adds a player and assigns a token', () => {
  let s = createInitialState();
  s = addPlayer(s, { name: 'Ahmet', color: '#e53935' });
  assert.equal(s.players.length, 1);
  assert.equal(s.players[0].name, 'Ahmet');
  assert.equal(s.players[0].balance, 0);
  assert.ok(s.players[0].id);
  assert.ok(s.players[0].token);
});

test('startGame gives every player the starting balance', () => {
  const s = setup();
  assert.equal(s.status, 'active');
  assert.equal(s.players[0].balance, 1500);
  assert.equal(s.players[1].balance, 1500);
  assert.equal(s.transactions.length, 2);
  assert.equal(s.transactions[0].type, 'initial');
});

test('startGame uses a custom starting balance', () => {
  let s = createInitialState();
  s = addPlayer(s, { name: 'A', color: '#f00' });
  s = addPlayer(s, { name: 'B', color: '#00f' });
  s.config.startingBalance = 1000;
  s = startGame(s);
  assert.equal(s.players[0].balance, 1000);
  assert.equal(s.players[1].balance, 1000);
});

test('startGame refuses with fewer than 2 players', () => {
  let s = createInitialState();
  s = addPlayer(s, { name: 'A', color: '#f00' });
  assert.throws(() => startGame(s), /errors\.minTwoPlayers/);
});

test('applyTransfer updates both balances', () => {
  let s = setup();
  const [a, b] = s.players;
  s = applyTransfer(s, { fromId: a.id, toId: b.id, amount: 200 });
  assert.equal(s.players[0].balance, 1300);
  assert.equal(s.players[1].balance, 1700);
  assert.equal(s.transactions.at(-1).type, 'transfer');
});

test('applyTransfer throws when the balance is insufficient', () => {
  const s = setup();
  const [a, b] = s.players;
  assert.throws(
    () => applyTransfer(s, { fromId: a.id, toId: b.id, amount: 9999 }),
    /errors\.insufficientBalance/
  );
});

test('applyTransfer refuses an invalid amount', () => {
  const s = setup();
  const [a, b] = s.players;
  assert.throws(() => applyTransfer(s, { fromId: a.id, toId: b.id, amount: 0 }), /errors\.invalidAmount/);
  assert.throws(() => applyTransfer(s, { fromId: a.id, toId: b.id, amount: -10 }), /errors\.invalidAmount/);
  assert.throws(() => applyTransfer(s, { fromId: a.id, toId: b.id, amount: NaN }), /errors\.invalidAmount/);
});

test('applyTransfer refuses a transfer to oneself', () => {
  const s = setup();
  const [a] = s.players;
  assert.throws(() => applyTransfer(s, { fromId: a.id, toId: a.id, amount: 10 }), /errors\.transferSelf/);
});

test('applyPassGo adds the bonus', () => {
  let s = setup();
  const [a] = s.players;
  s = applyPassGo(s, { playerId: a.id });
  assert.equal(s.players[0].balance, 1700);
  assert.equal(s.transactions.at(-1).type, 'pass-go');
});

test('applyBankerAdjust credits on positive and debits on negative amounts', () => {
  let s = setup();
  const [a] = s.players;
  s = applyBankerAdjust(s, { playerId: a.id, amount: 500 });
  assert.equal(s.players[0].balance, 2000);
  assert.equal(s.transactions.at(-1).type, 'banker-credit');
  s = applyBankerAdjust(s, { playerId: a.id, amount: -300 });
  assert.equal(s.players[0].balance, 1700);
  assert.equal(s.transactions.at(-1).type, 'banker-debit');
});

test('applyBankerAdjust refuses to take a balance below zero', () => {
  const s = setup();
  const [a] = s.players;
  assert.throws(
    () => applyBankerAdjust(s, { playerId: a.id, amount: -2000 }),
    /errors\.insufficientBalance/
  );
});

test('undoTransaction reverses a transfer', () => {
  let s = setup();
  const [a, b] = s.players;
  s = applyTransfer(s, { fromId: a.id, toId: b.id, amount: 200 });
  const txId = s.transactions.at(-1).id;
  s = undoTransaction(s, { transactionId: txId });
  assert.equal(s.players[0].balance, 1500);
  assert.equal(s.players[1].balance, 1500);
  assert.equal(s.transactions.find(t => t.id === txId).undone, true);
});

test('undoTransaction cannot undo the same transaction twice', () => {
  let s = setup();
  const [a, b] = s.players;
  s = applyTransfer(s, { fromId: a.id, toId: b.id, amount: 200 });
  const txId = s.transactions.at(-1).id;
  s = undoTransaction(s, { transactionId: txId });
  assert.throws(() => undoTransaction(s, { transactionId: txId }), /errors\.alreadyUndone/);
});

test('undoTransaction reverses a pass-go', () => {
  let s = setup();
  const [a] = s.players;
  s = applyPassGo(s, { playerId: a.id });
  const txId = s.transactions.at(-1).id;
  s = undoTransaction(s, { transactionId: txId });
  assert.equal(s.players[0].balance, 1500);
});

test('renamePlayer after the game starts changes only the name of only that player', () => {
  const s = setup();
  const [a, b] = s.players;
  const r = renamePlayer(s, { playerId: a.id, name: 'Yeni' });
  assert.equal(r.players[0].name, 'Yeni');
  assert.equal(r.players[0].token, a.token);
  assert.equal(r.players[0].balance, a.balance);
  assert.deepEqual(r.players[1], b);
});

test('renamePlayer trims leading and trailing whitespace', () => {
  const s = setup();
  const r = renamePlayer(s, { playerId: s.players[0].id, name: '  Ayşe  ' });
  assert.equal(r.players[0].name, 'Ayşe');
});

test('renamePlayer throws on an empty, blank or missing name', () => {
  const s = setup();
  const playerId = s.players[0].id;
  assert.throws(() => renamePlayer(s, { playerId, name: '' }), /errors\.nameEmpty/);
  assert.throws(() => renamePlayer(s, { playerId, name: '   ' }), /errors\.nameEmpty/);
  assert.throws(() => renamePlayer(s, { playerId }), /errors\.nameEmpty/);
});

test('renamePlayer throws for an unknown player', () => {
  const s = setup();
  assert.throws(() => renamePlayer(s, { playerId: 'yok', name: 'X' }), /errors\.playerNotFound/);
});

test('addPlayer accepts exactly 24 characters and refuses 25; surrounding whitespace does not count toward the limit', () => {
  const s = createInitialState();
  const ok = addPlayer(s, { name: 'a'.repeat(MAX_NAME_LENGTH), color: '#f00' });
  assert.equal(ok.players[0].name.length, 24);
  assert.throws(() => addPlayer(s, { name: 'a'.repeat(25), color: '#f00' }), /errors\.nameTooLong/);
  const padded = addPlayer(s, { name: `  ${'a'.repeat(24)}  `, color: '#f00' });
  assert.equal(padded.players[0].name, 'a'.repeat(24));
});

test('renamePlayer enforces the same 24-character limit', () => {
  const s = setup();
  const playerId = s.players[0].id;
  const r = renamePlayer(s, { playerId, name: ` ${'b'.repeat(24)} ` });
  assert.equal(r.players[0].name, 'b'.repeat(24));
  assert.throws(() => renamePlayer(s, { playerId, name: 'b'.repeat(25) }), /errors\.nameTooLong/);
});

test('addPlayer refuses the same name regardless of letter case, while an accent makes a different name', () => {
  let s = addPlayer(createInitialState(), { name: 'Ali', color: '#f00' });
  assert.throws(() => addPlayer(s, { name: 'ali', color: '#00f' }), /errors\.nameTaken/);
  assert.throws(() => addPlayer(s, { name: ' ALI ', color: '#00f' }), /errors\.nameTaken/);
  s = addPlayer(s, { name: 'Ayse', color: '#00f' });
  s = addPlayer(s, { name: 'Ayşe', color: '#0f0' });
  assert.equal(s.players.length, 3);
});

test('renamePlayer refuses a name another player has but allows changing the case of its own name', () => {
  const s = setup();
  const [a] = s.players;
  assert.throws(() => renamePlayer(s, { playerId: a.id, name: 'b' }), /errors\.nameTaken/);
  const r = renamePlayer(s, { playerId: a.id, name: 'a' });
  assert.equal(r.players[0].name, 'a');
});

test('a non-string name gives errors.nameEmpty instead of a TypeError', () => {
  assert.throws(() => addPlayer(createInitialState(), { name: 123, color: '#f00' }), /errors\.nameEmpty/);
  const s = setup();
  assert.throws(() => renamePlayer(s, { playerId: s.players[0].id, name: 123 }), /errors\.nameEmpty/);
});
