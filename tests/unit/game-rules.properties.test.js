import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  createInitialState,
  addPlayer,
  renamePlayer,
  startGame,
  applyTransfer,
  applyPassGo,
  applyBankerAdjust,
  undoTransaction,
} from '../../server/game-logic.js';

const NUM_RUNS = 300;

// ---- generators -----------------------------------------------------------

const amountArb = fc.oneof(
  fc.constantFrom(0, -1, 0.5, NaN, 1e21, Infinity, '5'),
  fc.integer({ min: -50, max: 1600 }),
);
const nameArb = fc.string({
  unit: fc.constantFrom('a', 'A', 'b', 'B', 'ş', 'Ş', ' ', 'x'),
  maxLength: 30,
});
const pick = fc.nat({ max: 8 });

const commandArb = fc.oneof(
  { arbitrary: fc.record({ kind: fc.constant('undo'), tx: pick }), weight: 3 },
  { arbitrary: fc.record({ kind: fc.constant('transfer'), from: pick, to: pick, amount: amountArb }), weight: 4 },
  fc.record({ kind: fc.constant('pass-go'), who: pick }),
  fc.record({ kind: fc.constant('adjust'), who: pick, amount: amountArb }),
  fc.record({ kind: fc.constant('rename'), who: pick, name: nameArb }),
);

const scenarioArb = fc.record({
  playerCount: fc.integer({ min: 2, max: 6 }),
  commands: fc.array(commandArb, { minLength: 1, maxLength: 60 }),
});

// ---- helpers --------------------------------------------------------------

function startedGame(playerCount) {
  let s = createInitialState();
  for (let i = 0; i < playerCount; i++) s = addPlayer(s, { name: `P${i}`, color: '#f00' });
  return startGame(s);
}

// Index past the end means "an id that does not exist".
function playerId(s, i) {
  return i < s.players.length ? s.players[i].id : 'ghost';
}
function txId(s, i) {
  return i < s.transactions.length ? s.transactions[i].id : 'ghost';
}

function apply(s, cmd) {
  switch (cmd.kind) {
    case 'transfer':
      return applyTransfer(s, { fromId: playerId(s, cmd.from), toId: playerId(s, cmd.to), amount: cmd.amount });
    case 'pass-go':
      return applyPassGo(s, { playerId: playerId(s, cmd.who) });
    case 'adjust':
      return applyBankerAdjust(s, { playerId: playerId(s, cmd.who), amount: cmd.amount });
    case 'undo':
      return undoTransaction(s, { transactionId: txId(s, cmd.tx) });
    case 'rename':
      return renamePlayer(s, { playerId: playerId(s, cmd.who), name: cmd.name });
  }
}

// Runs the commands. Only game-rule refusals (`errors.*`) are tolerated;
// any other exception is a bug and propagates.
// step: { cmd, before, after, refused }
function run(scenario, onStep) {
  let s = startedGame(scenario.playerCount);
  for (const cmd of scenario.commands) {
    const before = s;
    const snapshot = structuredClone(s);
    let after = null;
    try {
      after = apply(s, cmd);
    } catch (e) {
      if (!(e instanceof Error) || !e.message.startsWith('errors.')) throw e;
    }
    if (after) s = after;
    onStep?.({ cmd, before, snapshot, after: s, refused: after === null });
  }
  return s;
}

function replayBalances(s) {
  const bal = Object.fromEntries(s.players.map(p => [p.id, 0]));
  for (const t of s.transactions) {
    if (t.undone) continue;
    if (t.from !== undefined) bal[t.from] -= t.amount;
    if (t.to !== undefined) bal[t.to] += t.amount;
  }
  return bal;
}

function balancesOf(s) {
  return Object.fromEntries(s.players.map(p => [p.id, p.balance]));
}

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

const total = (s) => s.players.reduce((sum, p) => sum + p.balance, 0);
const opts = { numRuns: NUM_RUNS };

// ---- properties -----------------------------------------------------------

test('balances always equal a replay of the non-undone transactions', () => {
  fc.assert(fc.property(scenarioArb, (scenario) => {
    const s = run(scenario);
    assert.deepEqual(balancesOf(s), replayBalances(s));
  }), opts);
});

test('no sequence of actions makes a balance negative', () => {
  fc.assert(fc.property(scenarioArb, (scenario) => {
    run(scenario, ({ after }) => {
      for (const p of after.players) assert.ok(p.balance >= 0, `${p.name} has ${p.balance}`);
    });
  }), opts);
});

test('transfers never change the total money in the game', () => {
  fc.assert(fc.property(
    fc.record({
      playerCount: fc.integer({ min: 2, max: 6 }),
      transfers: fc.array(
        fc.record({ from: pick, to: pick, amount: amountArb }),
        { minLength: 1, maxLength: 60 },
      ),
    }),
    ({ playerCount, transfers }) => {
      let s = startedGame(playerCount);
      const expected = total(s);
      for (const t of transfers) {
        try {
          s = applyTransfer(s, { fromId: playerId(s, t.from), toId: playerId(s, t.to), amount: t.amount });
        } catch (e) {
          if (!e.message.startsWith('errors.')) throw e;
        }
        assert.equal(total(s), expected);
      }
    },
  ), opts);
});

test('a refused action changes nothing', () => {
  fc.assert(fc.property(scenarioArb, (scenario) => {
    run(scenario, ({ snapshot, after, refused }) => {
      // `snapshot` is a deep copy taken before the action, so an in-place write
      // made before the refusal would show up here.
      if (refused) assert.deepEqual(after, snapshot);
    });
  }), opts);
});

test('no game function mutates the state it receives', () => {
  fc.assert(fc.property(scenarioArb, (scenario) => {
    // A frozen input makes any in-place write throw a TypeError (not `errors.*`).
    let s = deepFreeze(startedGame(scenario.playerCount));
    for (const cmd of scenario.commands) {
      try {
        s = deepFreeze(apply(s, cmd));
      } catch (e) {
        if (!e.message.startsWith('errors.')) throw e;
      }
    }
  }), opts);
});

test('undoing the latest transaction restores every balance', () => {
  fc.assert(fc.property(scenarioArb, (scenario) => {
    // The state just before the most recent command that created a transaction.
    // A later successful undo changes balances again, so it voids the comparison.
    let beforeLast = null;
    const s = run(scenario, ({ cmd, before, after, refused }) => {
      if (refused) return;
      if (after.transactions.length > before.transactions.length) beforeLast = before;
      else if (cmd.kind === 'undo') beforeLast = null;
    });
    fc.pre(beforeLast !== null);
    const last = s.transactions[s.transactions.length - 1];
    let undone;
    try {
      undone = undoTransaction(s, { transactionId: last.id });
    } catch (e) {
      // Refused because the money was already spent: nothing to restore.
      if (e.message === 'errors.undoWouldOverdraw') return;
      throw e;
    }
    assert.deepEqual(balancesOf(undone), balancesOf(beforeLast));
  }), opts);
});

test('no sequence of adds and renames produces two names equal ignoring case', () => {
  const stepArb = fc.oneof(
    fc.record({ kind: fc.constant('add'), name: nameArb }),
    fc.record({ kind: fc.constant('rename'), who: pick, name: nameArb }),
  );
  fc.assert(fc.property(fc.array(stepArb, { minLength: 1, maxLength: 60 }), (steps) => {
    let s = createInitialState();
    for (const step of steps) {
      try {
        s = step.kind === 'add'
          ? addPlayer(s, { name: step.name, color: '#f00' })
          : renamePlayer(s, { playerId: playerId(s, step.who), name: step.name });
      } catch (e) {
        if (!e.message.startsWith('errors.')) throw e;
      }
      const lowered = s.players.map(p => p.name.toLowerCase());
      assert.equal(new Set(lowered).size, lowered.length, `names: ${JSON.stringify(s.players.map(p => p.name))}`);
    }
  }), opts);
});
