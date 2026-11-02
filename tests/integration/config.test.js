import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers/harness.js';

async function withApp(fn) {
  const app = await startApp();
  try { await fn(app); } finally { await app.stop(); }
}

test('start-game ignores invalid settings', async () => {
  await withApp(async (app) => {
    const banker = await app.banker();
    await banker.call('add-player', { name: 'Ann', color: '#123456' });
    await banker.call('add-player', { name: 'Bob', color: '#123456' });
    const ack = await banker.call('start-game', { startingBalance: 'abc', passGoBonus: -5 });
    assert.deepEqual(ack, { ok: true });
    const state = await app.state();
    assert.deepEqual(state.players.map((p) => p.balance), [1500, 1500]);
    assert.equal(state.config.passGoBonus, 200);
  });
});

test('a failed start leaves the settings unchanged', async () => {
  await withApp(async (app) => {
    const banker = await app.banker();
    await banker.call('add-player', { name: 'Ann', color: '#123456' });
    const ack = await banker.call('start-game', { startingBalance: 999, passGoBonus: 7 });
    assert.equal(ack.ok, false);
    const { config } = await app.state();
    assert.equal(config.startingBalance, 1500);
    assert.equal(config.passGoBonus, 200);
  });
});

test('update-config ignores invalid values', async () => {
  await withApp(async (app) => {
    const banker = await app.banker();
    const ack = await banker.call('update-config', {
      passGoBonus: -1, startingBalance: 0, currency: 'TOOLONG', quickAmounts: [],
    });
    assert.deepEqual(ack, { ok: true });
    const { config } = await app.state();
    assert.equal(config.passGoBonus, 200);
    assert.equal(config.startingBalance, 1500);
    assert.equal(config.currency, '₺');
    assert.deepEqual(config.quickAmounts, [1, 5, 10, 50, 100, 500]);
  });
});

test('quick amounts are cleaned: whole, unique, sorted, at most 12', async () => {
  await withApp(async (app) => {
    const banker = await app.banker();
    await banker.call('update-config', { quickAmounts: [50, '10', 10.9, 5, 5, -3, 0, 'x'] });
    assert.deepEqual((await app.state()).config.quickAmounts, [5, 10, 50]);
    await banker.call('update-config', { quickAmounts: Array.from({ length: 13 }, (_, i) => i + 1) });
    assert.deepEqual((await app.state()).config.quickAmounts, [5, 10, 50]);
    const twelve = Array.from({ length: 12 }, (_, i) => i + 1);
    await banker.call('update-config', { quickAmounts: twelve });
    assert.deepEqual((await app.state()).config.quickAmounts, twelve);
  });
});
