import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers/harness.js';

let app;
before(async () => { app = await startApp(); });
after(async () => { await app.stop(); });

test('a valid join link sets the player cookie and redirects to /player', async () => {
  const { players: [ann] } = await app.startGame(['Ann', 'Bob']);
  const res = await fetch(`${app.url}/join/${ann.token}`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.equal(new URL(res.headers.get('location'), app.url).pathname, '/player');
  const cookie = res.headers.get('set-cookie');
  assert.match(cookie, new RegExp(`playerToken=${ann.token}`));
  assert.match(cookie, /SameSite=Lax/);
});

test('an unknown join link answers 404 and sets no cookie', async () => {
  const res = await fetch(`${app.url}/join/nosuchtoken`, { redirect: 'manual' });
  assert.equal(res.status, 404);
  assert.equal(res.headers.get('set-cookie'), null);
});

test('the root address redirects to /player', async () => {
  const res = await fetch(`${app.url}/`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.equal(new URL(res.headers.get('location'), app.url).pathname, '/player');
});
