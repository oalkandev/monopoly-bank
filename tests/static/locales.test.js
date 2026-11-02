import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LOCALE_DIR = join(ROOT, 'client', 'src', 'locales');

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object') Object.assign(out, flatten(v, key));
    else out[key] = v;
  }
  return out;
}

const locales = Object.fromEntries(
  readdirSync(LOCALE_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => [f.replace(/\.json$/, ''), flatten(JSON.parse(readFileSync(join(LOCALE_DIR, f), 'utf8')))]),
);
const en = locales.en;
const others = Object.entries(locales).filter(([name]) => name !== 'en');

function sourceFiles(dir, exts) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'locales') continue;
      files.push(...sourceFiles(full, exts));
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      files.push(full);
    }
  }
  return files;
}

function placeholders(text) {
  return [...String(text).matchAll(/\{\{\s*([^}\s]+)\s*\}\}/g)].map((m) => m[1]).sort();
}

test('every locale has exactly the same keys as en', () => {
  assert.ok(others.length > 0, 'expected locales besides en');
  const enKeys = Object.keys(en).sort();
  for (const [name, flat] of others) {
    const keys = Object.keys(flat).sort();
    const missing = enKeys.filter((k) => !(k in flat));
    const extra = keys.filter((k) => !(k in en));
    assert.deepEqual({ missing, extra }, { missing: [], extra: [] }, `locale ${name} differs from en`);
  }
});

test('every {{placeholder}} in en appears in the same key of every locale', () => {
  for (const [name, flat] of others) {
    for (const [key, value] of Object.entries(en)) {
      if (!(key in flat)) continue; // missing keys are reported by the key parity test
      assert.deepEqual(placeholders(flat[key]), placeholders(value), `${name}: ${key}`);
    }
  }
});

test('every errors.* key thrown by the server exists in en', () => {
  const files = [join(ROOT, 'server.js'), ...sourceFiles(join(ROOT, 'server'), ['.js'])];
  const used = new Set();
  for (const file of files) {
    for (const m of readFileSync(file, 'utf8').matchAll(/['"`](errors\.[A-Za-z0-9_.]+)['"`]/g)) used.add(m[1]);
  }
  assert.ok(used.size > 0, 'expected the server to reference errors.* keys');
  const missing = [...used].filter((k) => !(k in en)).sort();
  assert.deepEqual(missing, []);
});

test('every literal t("...") key used in client/src exists in en', () => {
  const used = new Set();
  for (const file of sourceFiles(join(ROOT, 'client', 'src'), ['.js', '.jsx'])) {
    for (const m of readFileSync(file, 'utf8').matchAll(/(?<![A-Za-z0-9_$])t\(\s*(['"])([^'"`$]+)\1/g)) used.add(m[2]);
  }
  assert.ok(used.size > 0, 'expected the client to use t() keys');
  const missing = [...used]
    .filter((k) => !(k in en) && !(`${k}_one` in en) && !(`${k}_other` in en))
    .sort();
  assert.deepEqual(missing, []);
});
