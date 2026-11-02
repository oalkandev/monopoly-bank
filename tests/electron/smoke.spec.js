import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function freshDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'monopoly-desktop-'));
}

// The real game lives in the default userData folder. Every launch points at a temp folder
// and refuses to continue if Electron resolved anything else.
async function launch(tmp) {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ['.', `--user-data-dir=${tmp}`, '--lang=en-US'], cwd: ROOT, env });
  const userData = await app.evaluate(({ app: a }) => a.getPath('userData'));
  if (fs.realpathSync(userData) !== fs.realpathSync(tmp)) {
    await app.close();
    throw new Error(`Refusing to run: userData is ${userData}, expected ${tmp}`);
  }
  return app;
}

// In development mode Electron also opens a DevTools window, so pick the app window by its address.
async function appPage(app) {
  const isApp = (p) => p.url().startsWith('http://localhost:');
  await app.firstWindow();
  let page;
  await expect.poll(() => (page = app.windows().find(isApp)) !== undefined).toBe(true);
  return page;
}

function holdPort(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => resolve(server));
  });
}

function portIsFree(port) {
  return holdPort(port).then((s) => new Promise((r) => s.close(() => r(true))), () => false);
}

test('the app keeps its data in the folder it was given', async () => {
  const tmp = freshDir();
  const app = await launch(tmp);
  await app.close();
});

test('the app opens the banker screen', async () => {
  const app = await launch(freshDir());
  try {
    const page = await appPage(app);
    expect(new URL(page.url()).pathname).toBe('/banker');
    await expect(page.getByRole('button', { name: /Start Game/ })).toBeVisible();
  } finally {
    await app.close();
  }
});

test('the address, theme and language are the same after a relaunch', async () => {
  test.skip(!(await portIsFree(3737)), 'port 3737 is taken on this machine');
  const tmp = freshDir();
  let app = await launch(tmp);
  let page = await appPage(app);
  const origin = await page.evaluate(() => location.origin);
  await page.evaluate(() => {
    localStorage.setItem('monopoly-theme', 'monopoly-light');
    localStorage.setItem('monopoly-lang', 'de');
  });
  await app.close();

  app = await launch(tmp);
  try {
    page = await appPage(app);
    expect(await page.evaluate(() => location.origin)).toBe(origin);
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('monopoly-light');
    await expect(page.getByRole('button', { name: /Spiel starten/ })).toBeVisible();
  } finally {
    await app.close();
  }
});

test('the app still opens on another port when 3737 is taken', async () => {
  let blocker;
  try {
    blocker = await holdPort(3737);
  } catch {
    test.skip(true, 'port 3737 is already held by another program');
  }
  let app;
  try {
    app = await launch(freshDir());
    const page = await appPage(app);
    expect(new URL(page.url()).port).not.toBe('3737');
    await expect(page.getByRole('button', { name: /Start Game/ })).toBeVisible();
  } finally {
    await app?.close();
    await new Promise((r) => blocker.close(r));
  }
});
