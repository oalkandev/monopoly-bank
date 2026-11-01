import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers/harness.js';

let app;
before(async () => { app = await startApp(); });
after(async () => { await app.stop(); });

test('a transfer updates every connected screen', async () => {
  const isolated = await startApp();
  try {
    const { players: [ann, bob] } = await isolated.startGame(['Ann', 'Bob']);
    const annScreen = await isolated.player(ann.token);
    const bobScreen = await isolated.player(bob.token);
    const banker = await isolated.banker();
    const seen = [annScreen.nextState(), bobScreen.nextState(), banker.nextState()];
    const ack = await annScreen.call('transfer', { toId: bob.id, amount: 100 });
    assert.deepEqual(ack, { ok: true });
    for (const state of await Promise.all(seen)) {
      const balances = Object.fromEntries(state.players.map((p) => [p.name, p.balance]));
      assert.deepEqual(balances, { Ann: 1400, Bob: 1600 });
    }
  } finally {
    await isolated.stop();
  }
});

test('a refused action broadcasts nothing', async () => {
  const isolated = await startApp();
  try {
    const banker = await isolated.banker();
    const watcher = await isolated.anon();
    const next = watcher.nextState();
    const refused = await banker.call('start-game', {});
    assert.equal(refused.ok, false);
    const accepted = await banker.call('update-config', { currency: 'XY' });
    assert.deepEqual(accepted, { ok: true });
    // The first state the watcher sees is the later good action, so the refusal sent none.
    assert.equal((await next).config.currency, 'XY');
  } finally {
    await isolated.stop();
  }
});

test('a dice roll carries the rolling player’s id and is stored before it is announced', async () => {
  const isolated = await startApp();
  try {
    const { players: [ann] } = await isolated.startGame(['Ann', 'Bob']);
    const client = await isolated.player(ann.token);
    const announced = client.nextDice();
    assert.deepEqual(await client.call('roll-dice'), { ok: true });
    const roll = await announced;
    assert.equal(roll.playerId, ann.id);
    const stored = (await isolated.state()).diceRolls.map((r) => r.id);
    assert.ok(stored.includes(roll.id));
  } finally {
    await isolated.stop();
  }
});

test('dice are whole numbers from 1 to 6', async () => {
  const { players: [ann] } = await app.startGame(['Ann', 'Bob']);
  const client = await app.player(ann.token);
  const announced = client.nextDice();
  await client.call('roll-dice');
  const { dice } = await announced;
  assert.equal(dice.length, 2);
  for (const die of dice) {
    assert.ok(Number.isInteger(die) && die >= 1 && die <= 6, `bad die ${die}`);
  }
});

test('the history keeps only the newest 50 rolls', async () => {
  const isolated = await startApp();
  try {
    const { players: [ann] } = await isolated.startGame(['Ann', 'Bob']);
    const client = await isolated.player(ann.token);
    const ids = [];
    for (let i = 0; i < 51; i++) {
      const announced = client.nextDice();
      await client.call('roll-dice');
      ids.push((await announced).id);
    }
    const stored = (await isolated.state()).diceRolls.map((r) => r.id);
    assert.equal(stored.length, 50);
    assert.ok(!stored.includes(ids[0]));
    assert.ok(stored.includes(ids[50]));
  } finally {
    await isolated.stop();
  }
});
