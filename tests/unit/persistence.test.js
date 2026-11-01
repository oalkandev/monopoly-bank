import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
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
