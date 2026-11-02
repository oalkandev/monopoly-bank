import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startApp } from './helpers/harness.js';

const balanceOf = async (app, name) => (await app.state()).players.find((p) => p.name === name).balance;

// Runs `body` against a started game of Ann and Bob.
async function withGame(body) {
  const app = await startApp();
  try {
    const state = await app.startGame(['Ann', 'Bob']);
    await body(app, state.players);
  } finally {
    await app.stop();
  }
}

test('a player can pay the bank; nobody can pay it on behalf of another player or without a login', async () => {
  await withGame(async (app, [ann, bob]) => {
    const player = await app.player(ann.token);
    assert.deepEqual(await player.call('pay-to-bank', { amount: 100 }), { ok: true });
    assert.equal(await balanceOf(app, 'Ann'), 1400);
    // The player's own login decides who pays, whatever the payload names.
    assert.deepEqual(await player.call('pay-to-bank', { playerId: bob.id, amount: 100 }), { ok: true });
    assert.equal(await balanceOf(app, 'Ann'), 1300);
    assert.equal(await balanceOf(app, 'Bob'), 1500);

    const anonymous = await app.anon();
    assert.deepEqual(await anonymous.call('pay-to-bank', { playerId: bob.id, amount: 100 }), { ok: false, error: 'errors.unauthorized' });
    assert.equal(await balanceOf(app, 'Bob'), 1500);
  });
});

test('the banker can take a payment from the player named in the request', async () => {
  await withGame(async (app, [, bob]) => {
    const banker = await app.banker();
    assert.deepEqual(await banker.call('pay-to-bank', { playerId: bob.id, amount: 100 }), { ok: true });
    assert.equal(await balanceOf(app, 'Bob'), 1400);
  });
});

test('paying the bank needs an amount above zero, and a negative amount never gives money out', async () => {
  await withGame(async (app, [ann]) => {
    const player = await app.player(ann.token);
    for (const amount of [0, -50]) {
      assert.deepEqual(await player.call('pay-to-bank', { amount }), { ok: false, error: 'errors.invalidAmount' }, String(amount));
    }
    assert.equal(await balanceOf(app, 'Ann'), 1500);
  });
});

test('a transfer needs a login: a socket with no credentials is refused, the banker may move money between players', async () => {
  await withGame(async (app, [ann, bob]) => {
    const anonymous = await app.anon();
    assert.deepEqual(await anonymous.call('transfer', { fromId: ann.id, toId: bob.id, amount: 100 }), { ok: false, error: 'errors.unauthorized' });
    assert.equal(await balanceOf(app, 'Ann'), 1500);

    const banker = await app.banker();
    assert.deepEqual(await banker.call('transfer', { fromId: ann.id, toId: bob.id, amount: 100 }), { ok: true });
    assert.equal(await balanceOf(app, 'Ann'), 1400);
    assert.equal(await balanceOf(app, 'Bob'), 1600);
  });
});

test('only the banker passes Go, and it needs the player to pay', async () => {
  await withGame(async (app, [ann]) => {
    const player = await app.player(ann.token);
    assert.deepEqual(await player.call('pass-go', { playerId: ann.id }), { ok: false, error: 'errors.passGoBankerOnly' });
    assert.equal(await balanceOf(app, 'Ann'), 1500);

    const banker = await app.banker();
    assert.deepEqual(await banker.call('pass-go', {}), { ok: false, error: 'errors.playerIdRequired' });
    assert.deepEqual(await banker.call('pass-go'), { ok: false, error: 'errors.playerIdRequired' });
    assert.deepEqual(await banker.call('pass-go', { playerId: ann.id }), { ok: true });
    assert.equal(await balanceOf(app, 'Ann'), 1700);
  });
});

test('renaming needs a player login, and a request with no name says the name is empty', async () => {
  await withGame(async (app, [ann]) => {
    for (const client of [await app.anon(), await app.banker()]) {
      assert.deepEqual(await client.call('rename-player', { name: 'Zed' }), { ok: false, error: 'errors.unauthorized' });
    }
    const player = await app.player(ann.token);
    assert.deepEqual(await player.call('rename-player'), { ok: false, error: 'errors.nameEmpty' });
    assert.equal((await app.state()).players[0].name, 'Ann');
  });
});

test('a refused event sent without a callback does not bring the server down', async () => {
  await withGame(async (app) => {
    const anonymous = await app.anon();
    anonymous.socket.emit('reset');
    // Events on one socket are handled in order, so this answer comes after the refusal.
    assert.deepEqual(await anonymous.call('roll-dice'), { ok: false, error: 'errors.rollDiceOnly' });
    assert.equal((await app.state()).status, 'active');
  });
});

test('a player who connects again after going offline goes offline again when that connection closes', async () => {
  await withGame(async (app, [ann]) => {
    const watcher = await app.anon();
    const first = await app.player(ann.token);
    let seen = watcher.nextState();
    first.close();
    assert.equal((await seen).players[0].online, false);

    const again = await app.player(ann.token);
    seen = watcher.nextState();
    again.close();
    assert.equal((await seen).players[0].online, false);
  });
});

test('a player with three connections goes offline only when the last one closes', async () => {
  await withGame(async (app, [ann]) => {
    const watcher = await app.anon();
    const connections = [await app.player(ann.token), await app.player(ann.token), await app.player(ann.token)];
    connections[0].close();
    connections[1].close();
    const banker = await app.banker();
    // Closing with others open broadcasts nothing; a later good action shows the current state.
    let seen = banker.nextState();
    await banker.call('update-config', { currency: 'XY' });
    assert.equal((await seen).players[0].online, true);

    seen = watcher.nextState();
    connections[2].close();
    assert.equal((await seen).players[0].online, false);
  });
});

test('a save file with no player list loads as a game with no players', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'monopoly-bank-data-'));
  const dataFile = join(dir, 'game-state.json');
  await writeFile(dataFile, JSON.stringify({ version: 1, status: 'setup' }));
  const app = await startApp({ dataFile });
  try {
    assert.deepEqual((await app.state()).players, []);
  } finally {
    await app.stop();
    await rm(dir, { recursive: true, force: true });
  }
});
