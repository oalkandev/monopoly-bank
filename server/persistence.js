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
  let raw;
  try {
    raw = await fs.readFile(FILE, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    // Bozuk dosya silinmez: yan tarafa alınır, oyun boş başlar.
    const aside = `${FILE}.corrupt-${Date.now()}`;
    await fs.rename(FILE, aside);
    console.error(`Save file is corrupt (${err.message}); moved to ${aside}, starting empty.`);
    return null;
  }
}

let writeQueue = Promise.resolve();
export function save(state) {
  const write = writeQueue.then(async () => {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(TMP, JSON.stringify(state, null, 2));
    await fs.rename(TMP, FILE);
  });
  // Başarısız bir yazma sıradaki yazmaları engellemesin; çağırana gerçek sonuç döner.
  writeQueue = write.catch(() => {});
  return write;
}

export async function clear() {
  try { await fs.unlink(FILE); } catch (err) { if (err.code !== 'ENOENT') throw err; }
}
