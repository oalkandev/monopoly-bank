import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir, rm, realpath } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as persistence from '../../server/persistence.js';

test('a failed write does not block later writes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'monopoly-bank-persistence-'));
  const original = persistence.getFile();
  try {
    // A regular file where a directory is expected makes the first write fail.
    const blocker = join(dir, 'blocker');
    await writeFile(blocker, 'not a directory');
    persistence.setFile(join(blocker, 'game-state.json'));
    await assert.rejects(persistence.save({ marker: 'first' }));

    const good = join(dir, 'game-state.json');
    persistence.setFile(good);
    await persistence.save({ marker: 'second' });
    assert.deepEqual(JSON.parse(await readFile(good, 'utf8')), { marker: 'second' });
  } finally {
    persistence.setFile(original);
    await rm(dir, { recursive: true, force: true });
  }
});

const persistenceUrl = new URL('../../server/persistence.js', import.meta.url).href;

// Points the module at a fresh temp directory for one test and restores it afterwards.
async function withTempFile(run) {
  const dir = await mkdtemp(join(tmpdir(), 'monopoly-bank-persistence-'));
  const original = persistence.getFile();
  const file = join(dir, 'game-state.json');
  persistence.setFile(file);
  try {
    await run({ dir, file });
  } finally {
    persistence.setFile(original);
    await rm(dir, { recursive: true, force: true });
  }
}

test('the save file is the one the server was last pointed at', async () => {
  await withTempFile(async ({ file }) => {
    assert.equal(persistence.getFile(), file);
  });
});

test('without a configured path the game is saved as game-state.json in the working directory', async () => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'monopoly-bank-persistence-')));
  try {
    const script = `
      const p = await import(${JSON.stringify(persistenceUrl)});
      console.log(p.getFile());
      await p.save({ marker: 'default' });
    `;
    const { stdout } = await promisify(execFile)(
      process.execPath, ['--input-type=module', '-e', script], { cwd: dir },
    );
    assert.equal(stdout.trim(), join(dir, 'game-state.json'));
    assert.deepEqual(JSON.parse(await readFile(join(dir, 'game-state.json'), 'utf8')), { marker: 'default' });
    assert.deepEqual(await readdir(dir), ['game-state.json']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a game that was saved is loaded back unchanged', async () => {
  await withTempFile(async () => {
    const state = { status: 'active', players: [{ id: 'p_1', balance: 1500 }] };
    await persistence.save(state);
    assert.deepEqual(await persistence.load(), state);
  });
});

test('loading when nothing was ever saved starts empty', async () => {
  await withTempFile(async () => {
    assert.equal(await persistence.load(), null);
  });
});

test('a save file that cannot be read for another reason is an error, not an empty game', async () => {
  await withTempFile(async ({ dir }) => {
    await writeFile(join(dir, 'blocker'), 'not a directory');
    persistence.setFile(join(dir, 'blocker', 'game-state.json'));
    await assert.rejects(persistence.load(), { code: 'ENOTDIR' });
  });
});

test('a corrupt save file is moved aside with its content, never deleted, and the game starts empty', async () => {
  await withTempFile(async ({ dir, file }) => {
    const garbage = '{"players": [';
    await writeFile(file, garbage);
    const logged = console.error;
    console.error = () => {};
    let result;
    try {
      result = await persistence.load();
    } finally {
      console.error = logged;
    }
    assert.equal(result, null);
    const left = await readdir(dir);
    assert.equal(left.length, 1);
    assert.match(left[0], /^game-state\.json\.corrupt-\d+$/);
    assert.equal(await readFile(join(dir, left[0]), 'utf8'), garbage);
  });
});

test('clearing removes the saved game, and clearing when there is none is fine', async () => {
  await withTempFile(async ({ dir }) => {
    await persistence.save({ marker: 'x' });
    await persistence.clear();
    assert.deepEqual(await readdir(dir), []);
    await persistence.clear();
  });
});

test('clearing fails loudly when the file cannot be removed for another reason', async () => {
  await withTempFile(async ({ dir }) => {
    await writeFile(join(dir, 'blocker'), 'not a directory');
    persistence.setFile(join(dir, 'blocker', 'game-state.json'));
    await assert.rejects(persistence.clear(), { code: 'ENOTDIR' });
  });
});
