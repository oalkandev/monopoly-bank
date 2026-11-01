import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { networkInterfaces } from 'node:os';
import { startApp } from './helpers/harness.js';

let app;
before(async () => { app = await startApp(); });
after(async () => { await app.stop(); });

const balances = (state) => Object.fromEntries(state.players.map((p) => [p.name, p.balance]));

test("a player's transfer leaves their own account even if the payload names another fromId", async () => {
  const isolated = await startApp();
  try {
    const { players: [ann, bob, cem] } = await isolated.startGame(['Ann', 'Bob', 'Cem']);
    const client = await isolated.player(ann.token);
    const ack = await client.call('transfer', { fromId: bob.id, toId: cem.id, amount: 100 });
    assert.deepEqual(ack, { ok: true });
    assert.deepEqual(balances(await isolated.state()), { Ann: 1400, Bob: 1500, Cem: 1600 });
  } finally {
    await isolated.stop();
  }
});

test('rename changes the connected player even if the payload names another playerId', async () => {
  const isolated = await startApp();
  try {
    const { players: [ann, bob] } = await isolated.startGame(['Ann', 'Bob']);
    const client = await isolated.player(ann.token);
    const ack = await client.call('rename-player', { playerId: bob.id, name: 'Renamed' });
    assert.deepEqual(ack, { ok: true });
    const names = (await isolated.state()).players.map((p) => p.name);
    assert.deepEqual(names, ['Renamed', 'Bob']);
  } finally {
    await isolated.stop();
  }
});

test('the banker cannot roll dice', async () => {
  const banker = await app.banker();
  assert.deepEqual(await banker.call('roll-dice'), { ok: false, error: 'errors.rollDiceOnly' });
  assert.deepEqual((await app.state()).diceRolls, []);
});

test('a socket with an unknown token cannot roll dice', async () => {
  const stranger = await app.player('ffffffff');
  assert.deepEqual(await stranger.call('roll-dice'), { ok: false, error: 'errors.rollDiceOnly' });
  assert.deepEqual((await app.state()).diceRolls, []);
});

test('a connection from another website is refused', async () => {
  await assert.rejects(app.connect({
    transports: ['websocket'],
    extraHeaders: { Origin: 'https://evil.example' },
  }));
});

test("a connection from the app's own address is accepted", async () => {
  const client = await app.connect({
    transports: ['websocket'],
    extraHeaders: { Origin: `http://127.0.0.1:${app.port}` },
  });
  assert.ok(client.socket.connected);
});

test("a connection from the app's address on the local network is accepted", async (t) => {
  const lan = Object.values(networkInterfaces()).flat()
    .find((i) => i.family === 'IPv4' && !i.internal)?.address;
  if (!lan) return t.skip('no LAN address on this machine');
  const url = `http://${lan}:${app.port}`;
  const client = await app.connect({
    url,
    auth: { role: 'banker' },
    transports: ['websocket'],
    extraHeaders: { Origin: url },
  });
  assert.ok(client.socket.connected);
});
