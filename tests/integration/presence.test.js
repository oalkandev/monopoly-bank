import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers/harness.js';

const onlineOf = async (app, name) => (await app.state()).players.find((p) => p.name === name).online;

test('a player stays online while another connection is open', async () => {
  const app = await startApp();
  try {
    const { players: [ann] } = await app.startGame(['Ann', 'Bob']);
    const first = await app.player(ann.token);
    const second = await app.player(ann.token);
    const banker = await app.banker();
    first.close();
    // Closing with another connection open broadcasts nothing, so a later good action
    // flushes the server: its state is the first we can inspect.
    const seen = banker.nextState();
    assert.deepEqual(await banker.call('update-config', { currency: 'XY' }), { ok: true });
    const state = await seen;
    assert.equal(state.players.find((p) => p.name === 'Ann').online, true);
    assert.equal(await onlineOf(app, 'Ann'), true);
    second.close();
  } finally {
    await app.stop();
  }
});

test('a player goes offline when the last connection closes', async () => {
  const app = await startApp();
  try {
    const { players: [ann] } = await app.startGame(['Ann', 'Bob']);
    const only = await app.player(ann.token);
    const watcher = await app.anon();
    assert.equal(await onlineOf(app, 'Ann'), true);
    const seen = watcher.nextState();
    only.close();
    const state = await seen;
    assert.equal(state.players.find((p) => p.name === 'Ann').online, false);
  } finally {
    await app.stop();
  }
});
