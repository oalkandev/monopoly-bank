import { promises as fs } from 'node:fs';
import path from 'node:path';

let FILE = path.resolve('game-state.json');
let TMP = `${FILE}.tmp`;

export function setFile(absolutePath) {
  FILE = absolutePath;
  TMP = `${FILE}.tmp`;
}

export function getFile() {
  return FILE;
}

export async function load() {
  try {
    const raw = await fs.readFile(FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

let writeQueue = Promise.resolve();
export function save(state) {
  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(TMP, JSON.stringify(state, null, 2));
    await fs.rename(TMP, FILE);
  });
  return writeQueue;
}

export async function clear() {
  try { await fs.unlink(FILE); } catch (err) { if (err.code !== 'ENOENT') throw err; }
}
