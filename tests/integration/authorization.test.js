import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, withoutOnline } from './helpers/harness.js';

// Each banker event, the game phase it needs, and a payload the banker can use successfully.
const BANKER_EVENTS = [
  { event: 'add-player', phase: 'setup', payload: () => ({ name: 'Newcomer', color: '#abcdef' }) },
  { event: 'remove-player', phase: 'setup', payload: (s) => ({ playerId: s.players[0].id }) },
  { event: 'start-game', phase: 'setup', payload: () => ({}) },
  { event: 'update-config', phase: 'started', payload: () => ({ passGoBonus: 300 }) },
  { event: 'banker-adjust', phase: 'started', payload: (s) => ({ playerId: s.players[0].id, amount: 50 }) },
  {
    event: 'undo',
    phase: 'started',
    prepare: async (app, s) => {
      const banker = await app.banker();
      await banker.call('banker-adjust', { playerId: s.players[0].id, amount: 50 });
    },
    payload: (s) => ({ transactionId: s.transactions.at(-1).id }),
  },
  { event: 'reset', phase: 'started', payload: () => ({}) },
];

async function setup(entry) {
  const app = await startApp();
  try {
    let state = await (entry.phase === 'started' ? app.startGame(['Ann', 'Bob']) : addTwoPlayers(app));
    if (entry.prepare) {
      await entry.prepare(app, state);
      state = await app.state();
    }
    return { app, state };
  } catch (err) {
    await app.stop();
    throw err;
  }
}

async function addTwoPlayers(app) {
  const banker = await app.banker();
  for (const name of ['Ann', 'Bob']) await banker.call('add-player', { name, color: '#123456' });
  return app.state();
}

const CLIENTS = {
  anonymous: (app) => app.anon(),
  player: (app, state) => app.player(state.players[0].token),
};

for (const entry of BANKER_EVENTS) {
  describe(entry.event, () => {
    for (const [role, makeClient] of Object.entries(CLIENTS)) {
      test(`${role} cannot ${entry.event}`, async () => {
        const { app, state: before } = await setup(entry);
        try {
          const client = await makeClient(app, before);
          assert.deepEqual(await client.call(entry.event, entry.payload(before)), { ok: false, error: 'errors.unauthorized' });
          assert.deepEqual(withoutOnline(await app.state()), withoutOnline(before));
        } finally {
          await app.stop();
        }
      });
    }

    test(`the banker can ${entry.event}`, async () => {
      const { app, state: before } = await setup(entry);
      try {
        const banker = await app.banker();
        assert.deepEqual(await banker.call(entry.event, entry.payload(before)), { ok: true });
        assert.notDeepEqual(withoutOnline(await app.state()), withoutOnline(before));
      } finally {
        await app.stop();
      }
    });
  });
}

test('events sent without a payload answer with a translatable error key', async () => {
  const app = await startApp();
  try {
    const state = await app.startGame(['Ann', 'Bob']);
    const events = [...BANKER_EVENTS.map((e) => e.event), 'transfer', 'pay-to-bank', 'pass-go', 'rename-player'];
    for (const [name, client] of [['banker', await app.banker()], ['player', await app.player(state.players[0].token)]]) {
      for (const event of events) {
        const ack = await client.call(event);
        assert.ok(ack.ok || /^errors\./.test(ack.error), `${name} ${event}: ${JSON.stringify(ack)}`);
      }
    }
  } finally {
    await app.stop();
  }
});
