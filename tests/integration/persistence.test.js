import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, chmod, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startApp, withoutOnline } from './helpers/harness.js';

const LEGACY_FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'legacy-game-state.json');

const balances = (state) => Object.fromEntries(state.players.map((p) => [p.name, p.balance]));

// Runs `body` with a data file inside its own directory, so a test can lock that directory.
async function withDataDir(body) {
  const root = await mkdtemp(join(tmpdir(), 'monopoly-bank-data-'));
  const dataDir = join(root, 'data');
  await mkdir(dataDir);
  try {
    await body(dataDir, join(dataDir, 'game-state.json'));
  } finally {
    await chmod(dataDir, 0o700).catch(() => {});
    await rm(root, { recursive: true, force: true });
  }
}

test('a game survives a restart unchanged', async () => {
  const app = await startApp();
  try {
    await app.startGame(['Ann', 'Bob']);
    const banker = await app.banker();
    const [ann, bob] = (await app.state()).players;
    await banker.call('transfer', { fromId: ann.id, toId: bob.id, amount: 250 });
    await banker.call('banker-adjust', { playerId: ann.id, amount: 75 });
    await banker.call('pass-go', { playerId: bob.id });
    const before = await app.state();

    await app.restart();
    assert.deepEqual(await app.state(), before);
  } finally {
    await app.stop();
  }
});

test("a player's old link still works after a restart", async () => {
  const app = await startApp();
  try {
    const { players: [ann, bob] } = await app.startGame(['Ann', 'Bob']);
    await app.restart();
    const client = await app.player(ann.token);
    assert.deepEqual(await client.call('transfer', { fromId: ann.id, toId: bob.id, amount: 100 }), { ok: true });
    assert.deepEqual(balances(await app.state()), { Ann: 1400, Bob: 1600 });
  } finally {
    await app.stop();
  }
});

test('all players are offline after a restart until they reconnect', async () => {
  const app = await startApp();
  try {
    const { players: [ann, bob] } = await app.startGame(['Ann', 'Bob']);
    const player = await app.player(ann.token);
    // Any saved action while a player is connected would write `online: true` to disk.
    const banker = await app.banker();
    await banker.call('banker-adjust', { playerId: bob.id, amount: 10 });
    assert.equal((await app.state()).players.find((p) => p.id === ann.id).online, true);
    player.close();

    await app.restart();
    assert.deepEqual((await app.state()).players.map((p) => p.online), [false, false]);

    await app.player(ann.token);
    assert.deepEqual((await app.state()).players.map((p) => p.online), [true, false]);
  } finally {
    await app.stop();
  }
});

test('a crash during heavy writing never leaves an unreadable save file', async () => {
  const app = await startApp();
  try {
    const { players: [ann] } = await app.startGame(['Ann', 'Bob']);
    for (let round = 0; round < 3; round += 1) {
      const banker = await app.banker();
      const acks = Array.from({ length: 200 }, () => banker.call('banker-adjust', { playerId: ann.id, amount: 1 }));
      await acks[50]; // writing is under way; the rest are still queued
      await app.kill('SIGKILL');
      const saved = JSON.parse(await readFile(app.dataFile, 'utf8'));
      assert.equal(saved.players.length, 2);
      await app.restart();
    }
  } finally {
    await app.stop();
  }
});

test('a corrupt save file is kept aside and the server starts empty', async () => {
  await withDataDir(async (dataDir, dataFile) => {
    const garbage = '{"status": "active", "players": [';
    await writeFile(dataFile, garbage);
    const app = await startApp({ dataFile });
    try {
      const state = await app.state();
      assert.equal(state.status, 'setup');
      assert.deepEqual(state.players, []);

      const kept = (await readdir(dataDir)).filter((name) => name.startsWith('game-state.json.corrupt-'));
      assert.equal(kept.length, 1);
      assert.equal(await readFile(join(dataDir, kept[0]), 'utf8'), garbage);
      assert.match(app.stderr(), /corrupt/i);

      const banker = await app.banker();
      assert.deepEqual(await banker.call('add-player', { name: 'Ann', color: '#123456' }), { ok: true });
      assert.equal(JSON.parse(await readFile(dataFile, 'utf8')).players.length, 1);
    } finally {
      await app.stop();
    }
  });
});

// A locked directory cannot be enforced against root.
const skipAsRoot = process.getuid?.() === 0 ? 'root ignores directory permissions' : false;

test('an action still succeeds and reaches clients when the disk write fails', { skip: skipAsRoot }, async () => {
  await withDataDir(async (dataDir, dataFile) => {
    const app = await startApp({ dataFile });
    try {
      const { players: [ann] } = await app.startGame(['Ann', 'Bob']);
      const banker = await app.banker();
      await chmod(dataDir, 0o500);

      const broadcast = banker.nextState();
      assert.deepEqual(await banker.call('banker-adjust', { playerId: ann.id, amount: 100 }), { ok: true });
      assert.equal((await broadcast).players[0].balance, 1600);
      assert.equal((await app.state()).players[0].balance, 1600);
      assert.match(app.stderr(), /EACCES/);
    } finally {
      await chmod(dataDir, 0o700);
      await app.stop();
    }
  });
});

test('after a disk failure clears, the next action saves the full game', { skip: skipAsRoot }, async () => {
  await withDataDir(async (dataDir, dataFile) => {
    const app = await startApp({ dataFile });
    try {
      const { players: [ann] } = await app.startGame(['Ann', 'Bob']);
      const banker = await app.banker();
      await chmod(dataDir, 0o500);
      await banker.call('banker-adjust', { playerId: ann.id, amount: 100 });
      await chmod(dataDir, 0o700);
      await banker.call('banker-adjust', { playerId: ann.id, amount: 5 });

      const saved = JSON.parse(await readFile(dataFile, 'utf8'));
      assert.equal(saved.players[0].balance, 1605);
      assert.deepEqual(withoutOnline(saved), withoutOnline(await app.state()));
    } finally {
      await chmod(dataDir, 0o700);
      await app.stop();
    }
  });
});

test('a save file from an older version loads and the game continues', async () => {
  await withDataDir(async (dataDir, dataFile) => {
    await copyFile(LEGACY_FIXTURE, dataFile);
    const app = await startApp({ dataFile });
    try {
      const [ann, bob] = (await app.state()).players;
      const client = await app.player(ann.token);
      assert.deepEqual(await client.call('transfer', { fromId: ann.id, toId: bob.id, amount: 50 }), { ok: true });
      const banker = await app.banker();
      assert.deepEqual(await banker.call('pass-go', { playerId: ann.id }), { ok: true });
      assert.deepEqual(await client.call('roll-dice', {}), { ok: true });

      const state = await app.state();
      assert.deepEqual(balances(state), { Ann: 1550, Bob: 1650 });
      assert.equal(state.diceRolls.length, 1);
      assert.equal(JSON.parse(await readFile(dataFile, 'utf8')).diceRolls.length, 1);
    } finally {
      await app.stop();
    }
  });
});
