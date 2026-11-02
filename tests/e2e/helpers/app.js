import { test as base, expect, devices } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { io } from 'socket.io-client';

const ROOT = resolve(import.meta.dirname, '../../..');
const ENTRY = join(ROOT, 'tests/integration/helpers/server-entry.mjs');
const PUBLIC_DIR = join(ROOT, 'public');

const forceEnglish = () => localStorage.setItem('monopoly-lang', 'en');

function spawnServer({ port, dataFile }) {
  const env = { ...process.env, PORT: String(port), MONOPOLY_TEST_DATA_FILE: dataFile, MONOPOLY_TEST_PUBLIC_DIR: PUBLIC_DIR };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(process.execPath, [ENTRY], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (c) => { stderr += c; });
  const exited = new Promise((r) => child.once('exit', r));
  const listening = new Promise((res, rej) => {
    let out = '';
    child.stdout.on('data', (c) => {
      out += c;
      const m = /LISTENING (\d+)/.exec(out);
      if (m) res(Number(m[1]));
    });
    child.once('exit', (code) => rej(new Error(`server exited early (${code})\n${stderr}`)));
  });
  return { child, exited, listening };
}

/** A real server on a free port with its own data folder. */
async function startApp() {
  const dir = await mkdtemp(join(tmpdir(), 'monopoly-e2e-'));
  const dataFile = join(dir, 'game-state.json');
  const sockets = new Set();
  let server = spawnServer({ port: 0, dataFile });
  const app = { dir };
  app.port = await server.listening;
  app.url = `http://localhost:${app.port}`;

  app.socket = (auth) => new Promise((res, rej) => {
    const s = io(app.url, { auth, forceNew: true, reconnection: false });
    sockets.add(s);
    s.once('connect', () => res(s));
    s.once('connect_error', rej);
  });
  app.call = (s, event, payload) => new Promise((res) => s.emit(event, payload, res));
  app.state = async () => (await fetch(`${app.url}/api/state`)).json();

  /** Adds players (and optionally starts the game) through a banker socket. */
  app.setup = async (players, { start = true } = {}) => {
    const s = await app.socket({ role: 'banker' });
    for (const p of players) {
      const { name, color = '#2563eb' } = typeof p === 'string' ? { name: p } : p;
      const ack = await app.call(s, 'add-player', { name, color });
      if (!ack.ok) throw new Error(`add-player ${name}: ${ack.error}`);
    }
    if (start) {
      const ack = await app.call(s, 'start-game', {});
      if (!ack.ok) throw new Error(`start-game: ${ack.error}`);
    }
    return s;
  };
  /** The path of a player's join link, read from the server state. */
  app.linkPath = async (name) => {
    const player = (await app.state()).players.find((p) => p.name === name);
    return `/join/${player.token}`;
  };
  app.restart = async () => {
    server.child.kill('SIGTERM');
    await server.exited;
    server = spawnServer({ port: app.port, dataFile });
    await server.listening;
  };
  app.stop = async () => {
    for (const s of sockets) s.close();
    server.child.kill('SIGKILL');
    await server.exited;
    await rm(dir, { recursive: true, force: true });
  };
  return app;
}

export const test = base.extend({
  app: async ({}, use) => {
    const app = await startApp();
    await use(app);
    await app.stop();
  },

  webkit: [async ({ playwright }, use) => {
    const browser = await playwright.webkit.launch();
    await use(browser);
    await browser.close();
  }, { scope: 'worker' }],

  banker: async ({ browser, app }, use) => {
    const context = await browser.newContext();
    await context.addInitScript(forceEnglish);
    const page = await context.newPage();
    await page.goto(`${app.url}/banker`);
    await expect(page.getByText('Connected', { exact: true })).toBeVisible();
    await use(page);
    await context.close();
  },

  /**
   * phone(name) opens that player's join link on an iPhone 13 (WebKit, own cookies).
   * Options: `path` to open another page, `viewport` to override the screen.
   */
  phone: async ({ webkit, app }, use) => {
    const contexts = [];
    await use(async (name, { path, viewport } = {}) => {
      const context = await webkit.newContext({ ...devices['iPhone 13'], ...(viewport && { viewport }) });
      contexts.push(context);
      await context.addInitScript(forceEnglish);
      const page = await context.newPage();
      await page.goto(app.url + (path ?? await app.linkPath(name)));
      return page;
    });
    for (const c of contexts) await c.close();
  },
});

export { expect };

/** Opens Send Money on a phone and sends `amount` to the named player. */
export async function send(page, to, amount) {
  await page.getByRole('button', { name: 'Send Money' }).click();
  await page.getByRole('button', { name: to, exact: true }).click();
  await page.getByPlaceholder('0').fill(String(amount));
  await page.getByRole('button', { name: new RegExp(`Send .*to ${to}$`) }).click();
}

export const money = (n) => `${n.toLocaleString('en-US')}₺`;
export const bankerBalance = (banker, name) =>
  banker.getByTestId('player-card').filter({ hasText: name }).getByTestId('balance');

/**
 * Lets a page lose and regain its connection to the server. `context.setOffline` leaves an
 * open WebSocket alive, so sockets go through a proxy that can be cut. Reloads the page.
 * `cut()` waits until the connection has upgraded to a WebSocket, so nothing stays on polling.
 */
export async function withCuttableConnection(page) {
  let offline = false;
  const open = new Set();
  let upgraded;
  const firstUpgrade = new Promise((resolve) => { upgraded = resolve; });
  await page.routeWebSocket(/socket\.io/, (ws) => {
    if (offline) return ws.close();
    const server = ws.connectToServer();
    open.add(ws);
    server.onMessage((message) => ws.send(message));
    // The client sends "5" (engine.io upgrade packet) once it has moved off polling.
    ws.onMessage((message) => { server.send(message); if (message === '5') upgraded(); });
  });
  await page.route(/socket\.io/, (route) => (offline ? route.abort() : route.continue()));
  await page.reload();
  return {
    cut: async () => { await firstUpgrade; offline = true; open.forEach((ws) => ws.close()); open.clear(); },
    restore: () => { offline = false; },
  };
}
