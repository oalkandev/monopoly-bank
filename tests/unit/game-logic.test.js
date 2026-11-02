import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  addPlayer,
  renamePlayer,
  removePlayer,
  sanitizeConfig,
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

test('undo is refused when the recipient has already spent the money', () => {
  let s = createInitialState();
  for (const name of ['A', 'B', 'C']) s = addPlayer(s, { name, color: '#f00' });
  s = startGame(s);
  const [a, b, c] = s.players;
  s = applyTransfer(s, { fromId: a.id, toId: b.id, amount: 200 });
  const transactionId = s.transactions.at(-1).id;
  s = applyTransfer(s, { fromId: b.id, toId: c.id, amount: 1700 });
  assert.throws(() => undoTransaction(s, { transactionId }), /errors\.undoWouldOverdraw/);
  assert.deepEqual(s.players.map(p => p.balance), [1300, 0, 3200]);
});

test('undoing a banker debit is never refused, because it only gives money back', () => {
  let s = setup();
  const [a] = s.players;
  s = applyBankerAdjust(s, { playerId: a.id, amount: -1500 });
  const r = undoTransaction(s, { transactionId: s.transactions.at(-1).id });
  assert.equal(r.players[0].balance, 1500);
});

test('amounts must be whole numbers', () => {
  const s = setup();
  const [a, b] = s.players;
  for (const amount of [0.1, 1.5, 1e21]) {
    assert.throws(() => applyTransfer(s, { fromId: a.id, toId: b.id, amount }), /errors\.invalidAmount/);
    assert.throws(() => applyBankerAdjust(s, { playerId: a.id, amount }), /errors\.invalidAmount/);
    assert.throws(() => applyBankerAdjust(s, { playerId: a.id, amount: -amount }), /errors\.invalidAmount/);
  }
});

test('a banker adjustment may be a negative whole number but never zero', () => {
  const s = setup();
  const r = applyBankerAdjust(s, { playerId: s.players[0].id, amount: -100 });
  assert.equal(r.players[0].balance, 1400);
  assert.throws(() => applyBankerAdjust(s, { playerId: s.players[0].id, amount: 0 }), /errors\.invalidAmount/);
});

test('a player added without a color gets the fallback color', () => {
  const s = addPlayer(createInitialState(), { name: 'A' });
  assert.equal(s.players[0].color, '#475569');
});

test('a color that is not a 6-digit hex uses the fallback', () => {
  for (const color of ['red', 123, '#fff', 'url(x)', '#12345g']) {
    const s = addPlayer(createInitialState(), { name: 'A', color });
    assert.equal(s.players[0].color, '#475569', String(color));
  }
  assert.equal(addPlayer(createInitialState(), { name: 'A', color: '#3b82f6' }).players[0].color, '#3b82f6');
});

test('a new game starts with no dice rolls, and its default settings pass the same validation as edited ones', () => {
  const s = createInitialState();
  assert.deepEqual(s.diceRolls, []);
  const { currency, startingBalance, passGoBonus, quickAmounts } = s.config;
  assert.deepEqual(sanitizeConfig({ currency, startingBalance, passGoBonus, quickAmounts }), s.config);
});

test('a new player starts offline', () => {
  const s = addPlayer(createInitialState(), { name: 'A', color: '#3b82f6' });
  assert.equal(s.players[0].online, false);
});

test('a color must be exactly # followed by 6 hex digits, with nothing before or after', () => {
  for (const color of ['#3b82f6ff', 'x#3b82f6', '#3b82f6\n']) {
    const s = addPlayer(createInitialState(), { name: 'A', color });
    assert.equal(s.players[0].color, '#475569', JSON.stringify(color));
  }
});

test('players cannot be added once the game has started', () => {
  assert.throws(() => addPlayer(setup(), { name: 'C', color: '#f00' }), /errors\.playerAfterStart/);
});

test('removePlayer removes only the chosen player, and only before the game starts', () => {
  let s = createInitialState();
  for (const name of ['A', 'B', 'C']) s = addPlayer(s, { name, color: '#3b82f6' });
  const [a, b, c] = s.players;
  const r = removePlayer(s, { playerId: b.id });
  assert.deepEqual(r.players.map(p => p.id), [a.id, c.id]);
  assert.throws(() => removePlayer(startGame(s), { playerId: b.id }), /errors\.removePlayerAfterStart/);
});

test('a game that has started cannot be started again, so balances are not reset', () => {
  let s = setup();
  const [a, b] = s.players;
  s = applyTransfer(s, { fromId: a.id, toId: b.id, amount: 200 });
  assert.throws(() => startGame(s), /errors\.gameAlreadyStarted/);
  assert.deepEqual(s.players.map(p => p.balance), [1300, 1700]);
});

test('the pass-go bonus may be zero or more, and only a whole number', () => {
  assert.deepEqual(sanitizeConfig({ passGoBonus: 0 }), { passGoBonus: 0 });
  assert.deepEqual(sanitizeConfig({ passGoBonus: 200 }), { passGoBonus: 200 });
  for (const passGoBonus of [-5, 0.5, '200', null, NaN, Infinity]) {
    assert.deepEqual(sanitizeConfig({ passGoBonus }), {}, String(passGoBonus));
  }
});

test('the starting balance must be a whole number above zero', () => {
  assert.deepEqual(sanitizeConfig({ startingBalance: 1 }), { startingBalance: 1 });
  for (const startingBalance of [0, -1, 1.5, '1500', 'abc', Infinity, 1e21]) {
    assert.deepEqual(sanitizeConfig({ startingBalance }), {}, String(startingBalance));
  }
});

test('the currency must be a text of at most 5 characters', () => {
  assert.deepEqual(sanitizeConfig({ currency: '12345' }), { currency: '12345' });
  for (const currency of ['123456', 5, ['$'], { length: 1 }, null]) {
    assert.deepEqual(sanitizeConfig({ currency }), {}, JSON.stringify(currency));
  }
});

test('an update with no settings, or no update at all, changes nothing', () => {
  assert.deepEqual(sanitizeConfig({}), {});
  assert.deepEqual(sanitizeConfig(undefined), {});
  assert.deepEqual(sanitizeConfig(null), {});
});

test('quick amounts are cleaned into ascending whole numbers above zero without duplicates', () => {
  assert.deepEqual(
    sanitizeConfig({ quickAmounts: [100, '10', 5, 5, 20.9, -5, 0, 'abc', Infinity, 3] }).quickAmounts,
    [3, 5, 10, 20, 100],
  );
  assert.deepEqual(sanitizeConfig({ quickAmounts: [100, 20, 3] }).quickAmounts, [3, 20, 100]);
});

test('quick amounts are replaced only by a list of 1 to 12 usable amounts', () => {
  const upTo = (n) => Array.from({ length: n }, (_, i) => i + 1);
  assert.deepEqual(sanitizeConfig({ quickAmounts: [7] }).quickAmounts, [7]);
  assert.deepEqual(sanitizeConfig({ quickAmounts: upTo(12) }).quickAmounts, upTo(12));
  for (const quickAmounts of [[], [0, -1, 'abc'], upTo(13)]) {
    assert.deepEqual(sanitizeConfig({ quickAmounts }), {}, JSON.stringify(quickAmounts));
  }
  for (const quickAmounts of ['5', 5, null, { length: 1 }]) {
    assert.deepEqual(sanitizeConfig({ quickAmounts }), {}, JSON.stringify(quickAmounts));
  }
});

function overdrawnFirstPlayer(state, balance) {
  return { ...state, players: state.players.map((p, i) => (i === 0 ? { ...p, balance } : p)) };
}

test('undoing the initial balance takes it back, as long as the player still has it', () => {
  const s = setup();
  const initial = s.transactions.find(t => t.to === s.players[0].id);
  const r = undoTransaction(s, { transactionId: initial.id });
  assert.equal(r.players[0].balance, 0);
  assert.equal(r.transactions.find(t => t.id === initial.id).undone, true);
});

test('a transaction of an unknown kind cannot be undone', () => {
  const s = setup();
  const odd = { ...s, transactions: [...s.transactions, { id: 't_odd', type: 'mystery', amount: 5, undone: false }] };
  assert.throws(() => undoTransaction(odd, { transactionId: 't_odd' }), /errors\.unknownError/);
});

test('undo may leave a balance at exactly zero but never below it', () => {
  let s = createInitialState();
  for (const name of ['A', 'B', 'C']) s = addPlayer(s, { name, color: '#3b82f6' });
  s = startGame(s);
  const [a, b, c] = s.players;
  s = applyTransfer(s, { fromId: a.id, toId: b.id, amount: 200 });
  const transactionId = s.transactions.at(-1).id;
  s = applyTransfer(s, { fromId: b.id, toId: c.id, amount: 1500 });
  assert.equal(s.players[1].balance, 200);
  const r = undoTransaction(s, { transactionId });
  assert.deepEqual(r.players.map(p => p.balance), [1500, 0, 3000]);
});

test('money given to an overdrawn account is never refused, by a banker credit or by an undo', () => {
  let s = setup();
  const [a] = s.players;
  s = applyBankerAdjust(s, { playerId: a.id, amount: -30 });
  const debit = s.transactions.at(-1).id;
  s = overdrawnFirstPlayer(s, -100);
  assert.equal(applyBankerAdjust(s, { playerId: a.id, amount: 50 }).players[0].balance, -50);
  assert.equal(undoTransaction(s, { transactionId: debit }).players[0].balance, -70);
});
