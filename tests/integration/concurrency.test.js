import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startApp, withoutOnline } from './helpers/harness.js';

const balances = (state) => Object.fromEntries(state.players.map((p) => [p.name, p.balance]));

test('20 simultaneous transfers are all applied, in memory and on disk', async () => {
  const app = await startApp();
  try {
    const { players: [ann, bob] } = await app.startGame(['Ann', 'Bob']);
    const client = await app.player(ann.token);
    const acks = await Promise.all(
      Array.from({ length: 20 }, () => client.call('transfer', { fromId: ann.id, toId: bob.id, amount: 10 })),
    );
    assert.deepEqual(acks, Array.from({ length: 20 }, () => ({ ok: true })));

    const inMemory = await app.state();
    assert.deepEqual(balances(inMemory), { Ann: 1300, Bob: 1700 });
    assert.equal(inMemory.transactions.filter((t) => t.type === 'transfer').length, 20);
    const onDisk = JSON.parse(await readFile(app.dataFile, 'utf8'));
    assert.deepEqual(withoutOnline(onDisk), withoutOnline(inMemory));
  } finally {
    await app.stop();
  }
});

test('a double tap spending the same money succeeds exactly once', async () => {
  const app = await startApp();
  try {
    const { players: [ann, bob] } = await app.startGame(['Ann', 'Bob']);
    const client = await app.player(ann.token);
    const acks = await Promise.all([
      client.call('transfer', { fromId: ann.id, toId: bob.id, amount: 1000 }),
      client.call('transfer', { fromId: ann.id, toId: bob.id, amount: 1000 }),
    ]);
    assert.deepEqual(acks.filter((a) => a.ok), [{ ok: true }]);
    assert.deepEqual(acks.filter((a) => !a.ok), [{ ok: false, error: 'errors.insufficientBalance' }]);
    assert.deepEqual(balances(await app.state()), { Ann: 500, Bob: 2500 });
  } finally {
    await app.stop();
  }
});
