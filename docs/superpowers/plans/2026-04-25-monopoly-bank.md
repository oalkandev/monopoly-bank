# Monopoly Bank Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Local ağda çalışan bir Monopoly para yönetim uygulaması — bankacı bilgisayardan yönetir, oyuncular telefonlarından bağlanıp birbirlerine para transfer eder.

**Architecture:** Tek Node.js sunucu (Express + Socket.io). Vanilla JS frontend, build adımı yok. Durum bellekte tutulur ve her değişiklikte `game-state.json` dosyasına atomik yazılır. Saf oyun mantığı (`game-logic.js`) IO'dan ayrılır ve unit test edilir.

**Tech Stack:** Node.js 20+, Express, Socket.io, qrcode-terminal, node:test (built-in test runner).

---

## Dosya Yapısı

```
monopoly-bank/
├── package.json
├── server.js                      # Giriş noktası
├── server/
│   ├── state.js                   # Bellekteki durum + getter/setter
│   ├── persistence.js             # JSON dosyasına atomik yazım
│   ├── game-logic.js              # Saf fonksiyonlar (test edilir)
│   ├── routes.js                  # HTTP route'ları
│   └── socket-handlers.js         # Socket.io event handler'ları
├── public/
│   ├── banker.html
│   ├── banker.js
│   ├── player.html
│   ├── player.js
│   ├── join.html
│   ├── socket-client.js           # Paylaşılan Socket.io bağlantısı
│   ├── dom.js                     # createElement helper'ları (XSS-safe)
│   └── style.css
├── tests/
│   └── game-logic.test.js
├── docs/
└── .gitignore
```

`game-state.json` runtime'da oluşur, `.gitignore`'da yer alır.

---

## Task 1: Proje iskeleti

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `server.js`

- [ ] **Step 1: package.json oluştur**

```json
{
  "name": "monopoly-bank",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "test": "node --test tests/"
  },
  "dependencies": {
    "express": "^4.19.2",
    "socket.io": "^4.7.5",
    "qrcode-terminal": "^0.12.0"
  }
}
```

- [ ] **Step 2: .gitignore oluştur**

```
node_modules/
game-state.json
*.tmp
.DS_Store
```

- [ ] **Step 3: Bağımlılıkları kur**

Run: `npm install`
Expected: `node_modules/` oluşur, hata yok.

- [ ] **Step 4: Minimal server.js**

```javascript
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import os from 'node:os';
import qrcode from 'qrcode-terminal';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const PORT = 3000;

app.get('/', (_req, res) => res.send('Monopoly Bank up'));

httpServer.listen(PORT, '0.0.0.0', () => {
  const ip = Object.values(os.networkInterfaces())
    .flat()
    .find(i => i.family === 'IPv4' && !i.internal)?.address ?? 'localhost';
  const url = `http://${ip}:${PORT}/banker`;
  console.log(`\nMonopoly Bank hazir:\n  ${url}\n`);
  qrcode.generate(url, { small: true });
});
```

- [ ] **Step 5: Çalıştırıp doğrula**

Run: `npm start`
Expected: Konsola URL ve QR yazılır. Tarayıcıdan `http://localhost:3000` açılır, "Monopoly Bank up" görünür.
Sonra Ctrl+C ile durdur.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore server.js
git commit -m "chore: bootstrap node + express + socket.io"
```

---

## Task 2: Saf oyun mantığı (TDD)

**Files:**
- Create: `server/game-logic.js`
- Test: `tests/game-logic.test.js`

Bu modül bellek/dosya/ağ bilmez. Sadece state alır, yeni state veya hata döner.

- [ ] **Step 1: Failing testleri yaz**

```javascript
// tests/game-logic.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  addPlayer,
  startGame,
  applyTransfer,
  applyBankerAdjust,
  applyPassGo,
  undoTransaction,
} from '../server/game-logic.js';

test('createInitialState varsayilanlarla baslar', () => {
  const s = createInitialState();
  assert.equal(s.status, 'setup');
  assert.equal(s.config.startingBalance, 1500);
  assert.equal(s.config.passGoBonus, 200);
  assert.deepEqual(s.players, []);
  assert.deepEqual(s.transactions, []);
});

test('addPlayer oyuncu ekler ve token atar', () => {
  let s = createInitialState();
  s = addPlayer(s, { name: 'Ahmet', color: '#e53935' });
  assert.equal(s.players.length, 1);
  assert.equal(s.players[0].name, 'Ahmet');
  assert.equal(s.players[0].balance, 0);
  assert.ok(s.players[0].id);
  assert.ok(s.players[0].token);
});

test('startGame her oyuncuya baslangic parasi verir', () => {
  let s = createInitialState();
  s = addPlayer(s, { name: 'A', color: '#f00' });
  s = addPlayer(s, { name: 'B', color: '#00f' });
  s = startGame(s);
  assert.equal(s.status, 'active');
  assert.equal(s.players[0].balance, 1500);
  assert.equal(s.players[1].balance, 1500);
  assert.equal(s.transactions.length, 2);
  assert.equal(s.transactions[0].type, 'initial');
});

test('startGame ozel baslangic parasi kullanir', () => {
  let s = createInitialState();
  s = addPlayer(s, { name: 'A', color: '#f00' });
  s = addPlayer(s, { name: 'B', color: '#00f' });
  s.config.startingBalance = 1000;
  s = startGame(s);
  assert.equal(s.players[0].balance, 1000);
});

test('applyTransfer bakiyeleri gunceller', () => {
  let s = createInitialState();
  s = addPlayer(s, { name: 'A', color: '#f00' });
  s = addPlayer(s, { name: 'B', color: '#00f' });
  s = startGame(s);
  const [a, b] = s.players;
  s = applyTransfer(s, { fromId: a.id, toId: b.id, amount: 200 });
  assert.equal(s.players[0].balance, 1300);
  assert.equal(s.players[1].balance, 1700);
  assert.equal(s.transactions.at(-1).type, 'transfer');
});

test('applyTransfer yetersiz bakiyede hata atar', () => {
  let s = createInitialState();
  s = addPlayer(s, { name: 'A', color: '#f00' });
  s = addPlayer(s, { name: 'B', color: '#00f' });
  s = startGame(s);
  const [a, b] = s.players;
  assert.throws(
    () => applyTransfer(s, { fromId: a.id, toId: b.id, amount: 9999 }),
    /yetersiz bakiye/i
  );
});

test('applyTransfer gecersiz miktari reddeder', () => {
  let s = createInitialState();
  s = addPlayer(s, { name: 'A', color: '#f00' });
  s = addPlayer(s, { name: 'B', color: '#00f' });
  s = startGame(s);
  const [a, b] = s.players;
  assert.throws(() => applyTransfer(s, { fromId: a.id, toId: b.id, amount: 0 }), /gecersiz/i);
  assert.throws(() => applyTransfer(s, { fromId: a.id, toId: b.id, amount: -10 }), /gecersiz/i);
});

test('applyTransfer ayni kisiye gonderimi reddeder', () => {
  let s = createInitialState();
  s = addPlayer(s, { name: 'A', color: '#f00' });
  s = addPlayer(s, { name: 'B', color: '#00f' });
  s = startGame(s);
  const [a] = s.players;
  assert.throws(() => applyTransfer(s, { fromId: a.id, toId: a.id, amount: 10 }), /ayni/i);
});

test('applyPassGo bonus ekler', () => {
  let s = createInitialState();
  s = addPlayer(s, { name: 'A', color: '#f00' });
  s = addPlayer(s, { name: 'B', color: '#00f' });
  s = startGame(s);
  const [a] = s.players;
  s = applyPassGo(s, { playerId: a.id });
  assert.equal(s.players[0].balance, 1700);
  assert.equal(s.transactions.at(-1).type, 'pass-go');
});

test('applyBankerAdjust pozitif kredit, negatif borc', () => {
  let s = createInitialState();
  s = addPlayer(s, { name: 'A', color: '#f00' });
  s = addPlayer(s, { name: 'B', color: '#00f' });
  s = startGame(s);
  const [a] = s.players;
  s = applyBankerAdjust(s, { playerId: a.id, amount: 500 });
  assert.equal(s.players[0].balance, 2000);
  assert.equal(s.transactions.at(-1).type, 'banker-credit');
  s = applyBankerAdjust(s, { playerId: a.id, amount: -300 });
  assert.equal(s.players[0].balance, 1700);
  assert.equal(s.transactions.at(-1).type, 'banker-debit');
});

test('undoTransaction transferi tersine cevirir', () => {
  let s = createInitialState();
  s = addPlayer(s, { name: 'A', color: '#f00' });
  s = addPlayer(s, { name: 'B', color: '#00f' });
  s = startGame(s);
  const [a, b] = s.players;
  s = applyTransfer(s, { fromId: a.id, toId: b.id, amount: 200 });
  const txId = s.transactions.at(-1).id;
  s = undoTransaction(s, { transactionId: txId });
  assert.equal(s.players[0].balance, 1500);
  assert.equal(s.players[1].balance, 1500);
  assert.equal(s.transactions.find(t => t.id === txId).undone, true);
});

test('undoTransaction iki kez ayni islemi geri alamaz', () => {
  let s = createInitialState();
  s = addPlayer(s, { name: 'A', color: '#f00' });
  s = addPlayer(s, { name: 'B', color: '#00f' });
  s = startGame(s);
  const [a, b] = s.players;
  s = applyTransfer(s, { fromId: a.id, toId: b.id, amount: 200 });
  const txId = s.transactions.at(-1).id;
  s = undoTransaction(s, { transactionId: txId });
  assert.throws(() => undoTransaction(s, { transactionId: txId }), /zaten/i);
});
```

- [ ] **Step 2: Testleri çalıştır, hepsi FAIL**

Run: `npm test`
Expected: Tüm testler FAIL ("Cannot find module ../server/game-logic.js" benzeri).

- [ ] **Step 3: game-logic.js implementasyonu**

```javascript
// server/game-logic.js
import { randomBytes } from 'node:crypto';

const id = (prefix) => `${prefix}_${randomBytes(4).toString('hex')}`;
const token = () => randomBytes(4).toString('hex');

export function createInitialState() {
  return {
    version: 1,
    status: 'setup',
    config: { currency: '₺', startingBalance: 1500, passGoBonus: 200 },
    players: [],
    transactions: [],
  };
}

export function addPlayer(state, { name, color }) {
  if (state.status !== 'setup') throw new Error('Oyun basladiktan sonra oyuncu eklenemez');
  if (!name?.trim()) throw new Error('Isim bos olamaz');
  return {
    ...state,
    players: [...state.players, {
      id: id('p'), name: name.trim(), color, token: token(),
      balance: 0, online: false,
    }],
  };
}

export function startGame(state) {
  if (state.status !== 'setup') throw new Error('Oyun zaten basladi');
  if (state.players.length < 2) throw new Error('En az 2 oyuncu gerekli');
  const ts = Date.now();
  const players = state.players.map(p => ({ ...p, balance: state.config.startingBalance }));
  const transactions = state.players.map(p => ({
    id: id('t'), ts, type: 'initial', to: p.id,
    amount: state.config.startingBalance, undone: false,
  }));
  return { ...state, status: 'active', players, transactions };
}

function findPlayer(state, playerId) {
  const p = state.players.find(p => p.id === playerId);
  if (!p) throw new Error(`Oyuncu bulunamadi: ${playerId}`);
  return p;
}

function updateBalance(state, playerId, delta) {
  return {
    ...state,
    players: state.players.map(p =>
      p.id === playerId ? { ...p, balance: p.balance + delta } : p
    ),
  };
}

function appendTx(state, tx) {
  return { ...state, transactions: [...state.transactions, { id: id('t'), ts: Date.now(), undone: false, ...tx }] };
}

export function applyTransfer(state, { fromId, toId, amount }) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Gecersiz miktar');
  if (fromId === toId) throw new Error('Ayni kisiye gonderim yapilamaz');
  const from = findPlayer(state, fromId);
  findPlayer(state, toId);
  if (from.balance < amount) throw new Error('Yetersiz bakiye');
  let s = updateBalance(state, fromId, -amount);
  s = updateBalance(s, toId, amount);
  return appendTx(s, { type: 'transfer', from: fromId, to: toId, amount });
}

export function applyPassGo(state, { playerId }) {
  findPlayer(state, playerId);
  const bonus = state.config.passGoBonus;
  const s = updateBalance(state, playerId, bonus);
  return appendTx(s, { type: 'pass-go', to: playerId, amount: bonus });
}

export function applyBankerAdjust(state, { playerId, amount }) {
  if (!Number.isFinite(amount) || amount === 0) throw new Error('Gecersiz miktar');
  const p = findPlayer(state, playerId);
  if (amount < 0 && p.balance + amount < 0) throw new Error('Yetersiz bakiye');
  const s = updateBalance(state, playerId, amount);
  return appendTx(s, amount > 0
    ? { type: 'banker-credit', to: playerId, amount }
    : { type: 'banker-debit', from: playerId, amount: -amount });
}

export function undoTransaction(state, { transactionId }) {
  const tx = state.transactions.find(t => t.id === transactionId);
  if (!tx) throw new Error(`Islem bulunamadi: ${transactionId}`);
  if (tx.undone) throw new Error('Bu islem zaten geri alindi');
  let s = state;
  switch (tx.type) {
    case 'transfer':
      s = updateBalance(s, tx.from, tx.amount);
      s = updateBalance(s, tx.to, -tx.amount);
      break;
    case 'pass-go':
    case 'banker-credit':
    case 'initial':
      s = updateBalance(s, tx.to, -tx.amount);
      break;
    case 'banker-debit':
      s = updateBalance(s, tx.from, tx.amount);
      break;
    default:
      throw new Error(`Bilinmeyen islem tipi: ${tx.type}`);
  }
  return {
    ...s,
    transactions: s.transactions.map(t => t.id === transactionId ? { ...t, undone: true } : t),
  };
}
```

- [ ] **Step 4: Testleri çalıştır, hepsi PASS**

Run: `npm test`
Expected: Tüm 12 test PASS.

- [ ] **Step 5: Commit**

```bash
git add server/game-logic.js tests/game-logic.test.js
git commit -m "feat(game-logic): pure state transitions with tests"
```

---

## Task 3: Persistence (atomik JSON yazımı)

**Files:**
- Create: `server/persistence.js`

- [ ] **Step 1: persistence.js**

```javascript
// server/persistence.js
import { promises as fs } from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('game-state.json');
const TMP = `${FILE}.tmp`;

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
    await fs.writeFile(TMP, JSON.stringify(state, null, 2));
    await fs.rename(TMP, FILE);
  });
  return writeQueue;
}

export async function clear() {
  try { await fs.unlink(FILE); } catch (err) { if (err.code !== 'ENOENT') throw err; }
}
```

- [ ] **Step 2: Manual smoke test**

Run:
```bash
node --input-type=module -e "
import { save, load, clear } from './server/persistence.js';
await clear();
console.log('after clear:', await load());
await save({ hello: 'world' });
console.log('after save:', await load());
await clear();
"
```
Expected: `after clear: null`, sonra `after save: { hello: 'world' }`.

- [ ] **Step 3: Commit**

```bash
git add server/persistence.js
git commit -m "feat(persistence): atomic JSON state file"
```

---

## Task 4: State store (bellek + persistence köprüsü)

**Files:**
- Create: `server/state.js`

- [ ] **Step 1: state.js**

```javascript
// server/state.js
import * as logic from './game-logic.js';
import * as persistence from './persistence.js';

let state = logic.createInitialState();
const listeners = new Set();

export async function init() {
  const loaded = await persistence.load();
  if (loaded) state = loaded;
}

export function get() { return state; }

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

async function commit(next) {
  state = next;
  await persistence.save(state);
  for (const fn of listeners) fn(state);
}

export async function reset() {
  await commit(logic.createInitialState());
}

export async function addPlayer(payload) { await commit(logic.addPlayer(state, payload)); }
export async function startGame(config) {
  if (config) state = { ...state, config: { ...state.config, ...config } };
  await commit(logic.startGame(state));
}
export async function transfer(payload) { await commit(logic.applyTransfer(state, payload)); }
export async function passGo(payload) { await commit(logic.applyPassGo(state, payload)); }
export async function bankerAdjust(payload) { await commit(logic.applyBankerAdjust(state, payload)); }
export async function undo(payload) { await commit(logic.undoTransaction(state, payload)); }

export function setOnline(playerId, online) {
  const players = state.players.map(p => p.id === playerId ? { ...p, online } : p);
  state = { ...state, players };
  for (const fn of listeners) fn(state);
}

export function findByToken(token) {
  return state.players.find(p => p.token === token) ?? null;
}
```

- [ ] **Step 2: Commit**

```bash
git add server/state.js
git commit -m "feat(state): in-memory store with persistence + subscribers"
```

---

## Task 5: HTTP route'ları + statik servis

**Files:**
- Modify: `server.js`
- Create: `server/routes.js`

- [ ] **Step 1: routes.js**

```javascript
// server/routes.js
import express from 'express';
import path from 'node:path';
import * as state from './state.js';

export function mountRoutes(app) {
  app.use(express.json());
  app.use(express.static(path.resolve('public')));

  app.get('/', (_req, res) => res.redirect('/player'));
  app.get('/player', (_req, res) => res.sendFile(path.resolve('public/player.html')));
  app.get('/banker', (_req, res) => res.sendFile(path.resolve('public/banker.html')));

  app.get('/join/:token', (req, res) => {
    const player = state.findByToken(req.params.token);
    if (!player) return res.status(404).sendFile(path.resolve('public/join.html'));
    res.cookie('playerToken', req.params.token, { httpOnly: false, sameSite: 'lax' });
    res.redirect('/player');
  });

  app.get('/api/state', (_req, res) => res.json(state.get()));
}
```

- [ ] **Step 2: server.js'e route'ları bağla**

```javascript
// server.js
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import os from 'node:os';
import qrcode from 'qrcode-terminal';
import { mountRoutes } from './server/routes.js';
import * as state from './server/state.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const PORT = 3000;

await state.init();
mountRoutes(app);

httpServer.listen(PORT, '0.0.0.0', () => {
  const ip = Object.values(os.networkInterfaces())
    .flat()
    .find(i => i.family === 'IPv4' && !i.internal)?.address ?? 'localhost';
  const url = `http://${ip}:${PORT}/banker`;
  console.log(`\nMonopoly Bank hazir:\n  ${url}\n`);
  qrcode.generate(url, { small: true });
});
```

- [ ] **Step 3: Smoke test**

Run: `npm start`
Sonra başka bir terminalde:
```bash
curl -s http://localhost:3000/api/state
```
Expected: `{"version":1,"status":"setup","config":{...},"players":[],"transactions":[]}`. Sonra Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add server.js server/routes.js
git commit -m "feat(routes): http routes, static, join cookie flow"
```

---

## Task 6: Socket.io handler'ları

**Files:**
- Create: `server/socket-handlers.js`
- Modify: `server.js`

- [ ] **Step 1: socket-handlers.js**

```javascript
// server/socket-handlers.js
import * as state from './state.js';

export function attachSockets(io) {
  state.subscribe((s) => io.emit('state', s));

  io.on('connection', (socket) => {
    const { token, role } = socket.handshake.auth ?? {};
    let playerId = null;

    if (role === 'banker') {
      socket.join('bankers');
    } else if (token) {
      const player = state.findByToken(token);
      if (player) {
        playerId = player.id;
        state.setOnline(playerId, true);
      }
    }

    socket.emit('state', state.get());

    const wrap = (fn) => async (payload, ack) => {
      try { await fn(payload); ack?.({ ok: true }); }
      catch (err) { ack?.({ ok: false, error: err.message }); }
    };

    socket.on('add-player', wrap(state.addPlayer));
    socket.on('start-game', wrap(state.startGame));
    socket.on('transfer', wrap(async (p) => {
      if (!playerId && role !== 'banker') throw new Error('Yetkisiz');
      await state.transfer({ ...p, fromId: playerId ?? p.fromId });
    }));
    socket.on('pass-go', wrap(async () => {
      if (!playerId) throw new Error('Yetkisiz');
      await state.passGo({ playerId });
    }));
    socket.on('banker-adjust', wrap(state.bankerAdjust));
    socket.on('undo', wrap(state.undo));
    socket.on('reset', wrap(state.reset));

    socket.on('disconnect', () => {
      if (playerId) state.setOnline(playerId, false);
    });
  });
}
```

- [ ] **Step 2: server.js'e socket'leri bağla**

`mountRoutes(app);` satırının altına ekle:
```javascript
import { attachSockets } from './server/socket-handlers.js';
attachSockets(io);
```

- [ ] **Step 3: Sunucuyu çalıştır, crash olmamalı**

Run: `npm start`
Expected: Konsola URL yazılır, `curl http://localhost:3000/api/state` çalışır. Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add server.js server/socket-handlers.js
git commit -m "feat(sockets): wire transfer/adjust/undo/reset events"
```

---

## Task 7: DOM helper'ı (XSS-safe rendering)

**Files:**
- Create: `public/dom.js`

Frontend'te kullanıcı verisi (oyuncu adı) ekrana basılıyor. Tüm rendering'i `createElement + textContent` ile yapacağız ki XSS imkansız olsun. Bu helper kısa bir DSL sağlar.

- [ ] **Step 1: dom.js**

```javascript
// public/dom.js — XSS-safe DOM construction
// Kullanim: el('div', { class: 'card' }, [el('h2', {}, ['Baslik']), 'metin'])
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'data' && typeof v === 'object') for (const [dk, dv] of Object.entries(v)) node.dataset[dk] = dv;
    else node.setAttribute(k, v);
  }
  for (const child of children) {
    if (child == null || child === false) continue;
    if (child instanceof Node) node.appendChild(child);
    else node.appendChild(document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function replaceChildren(node, children) {
  clear(node);
  for (const c of children) if (c) node.appendChild(c);
}
```

- [ ] **Step 2: Commit**

```bash
git add public/dom.js
git commit -m "feat(dom): xss-safe element helper"
```

---

## Task 8: Paylaşılan socket client + style

**Files:**
- Create: `public/socket-client.js`
- Create: `public/style.css`

- [ ] **Step 1: socket-client.js**

```javascript
// public/socket-client.js
function getCookie(name) {
  return document.cookie.split('; ').find(c => c.startsWith(name + '='))?.split('=')[1];
}

export function connect({ role } = {}) {
  const auth = role === 'banker' ? { role: 'banker' } : { token: getCookie('playerToken') };
  return io({ auth });
}

export function emit(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.emit(event, payload, (ack) => {
      if (ack?.ok) resolve(ack);
      else reject(new Error(ack?.error ?? 'Bilinmeyen hata'));
    });
  });
}

export function describeTx(t, s) {
  const name = (id) => s.players.find(p => p.id === id)?.name ?? '?';
  const cur = s.config.currency;
  switch (t.type) {
    case 'transfer': return `${name(t.from)} -> ${name(t.to)}: ${t.amount}${cur}`;
    case 'pass-go': return `Banka -> ${name(t.to)}: ${t.amount}${cur} (GO)`;
    case 'banker-credit': return `Banka -> ${name(t.to)}: ${t.amount}${cur}`;
    case 'banker-debit': return `${name(t.from)} -> Banka: ${t.amount}${cur}`;
    case 'initial': return `Baslangic -> ${name(t.to)}: ${t.amount}${cur}`;
    default: return t.type;
  }
}
```

- [ ] **Step 2: style.css**

```css
* { box-sizing: border-box; }
body { font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 16px; background: #f5f5f5; color: #222; }
h1, h2 { margin: 0 0 12px; }
button { font-size: 16px; padding: 12px 16px; border: none; border-radius: 8px; background: #1976d2; color: white; cursor: pointer; min-height: 44px; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
button.secondary { background: #eee; color: #222; }
button.danger { background: #d32f2f; }
input, select { font-size: 16px; padding: 10px; border-radius: 6px; border: 1px solid #ccc; width: 100%; }
.card { background: white; border-radius: 12px; padding: 16px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
.balance { font-size: 48px; font-weight: 700; text-align: center; margin: 16px 0; }
.player-chip { display: inline-block; padding: 4px 10px; border-radius: 999px; color: white; font-weight: 600; font-size: 14px; }
.tx-row { padding: 8px 0; border-bottom: 1px solid #eee; font-size: 14px; }
.tx-row.undone { opacity: 0.4; text-decoration: line-through; }
.row { display: flex; gap: 8px; align-items: center; }
.grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
```

- [ ] **Step 3: Commit**

```bash
git add public/socket-client.js public/style.css
git commit -m "feat(public): shared socket client and styles"
```

---

## Task 9: Bankacı paneli

**Files:**
- Create: `public/banker.html`
- Create: `public/banker.js`

- [ ] **Step 1: banker.html (yapı, içerik JS ile dolacak)**

```html
<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Monopoly Bank — Bankaci</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <h1>Bankaci Paneli</h1>

  <section id="setup" class="card" hidden>
    <h2>Oyun Kurulumu</h2>
    <label>Baslangic Parasi: <input id="startingBalance" type="number" value="1500"></label>
    <label>GO Bonusu: <input id="passGoBonus" type="number" value="200"></label>
    <hr>
    <h3>Oyuncu Ekle</h3>
    <div class="row">
      <input id="newName" placeholder="Ad">
      <input id="newColor" type="color" value="#e53935">
      <button id="addPlayer">Ekle</button>
    </div>
    <div id="players" class="grid" style="margin-top:12px"></div>
    <button id="startGame" style="margin-top:12px" disabled>Oyunu Baslat</button>
  </section>

  <section id="active" class="card" hidden>
    <h2>Oyuncular</h2>
    <div id="activePlayers" class="grid"></div>
    <h2>Islem Gecmisi</h2>
    <div id="transactions"></div>
    <hr>
    <button id="reset" class="danger">Oyunu Sifirla</button>
  </section>

  <script src="/socket.io/socket.io.js"></script>
  <script type="module" src="/banker.js"></script>
</body>
</html>
```

- [ ] **Step 2: banker.js (createElement ile XSS-safe)**

```javascript
import { connect, emit, describeTx } from '/socket-client.js';
import { el, replaceChildren } from '/dom.js';

const socket = connect({ role: 'banker' });
const $ = (id) => document.getElementById(id);
let currentState = null;

socket.on('state', (s) => { currentState = s; render(s); });

$('addPlayer').addEventListener('click', async () => {
  const name = $('newName').value.trim();
  const color = $('newColor').value;
  if (!name) return;
  try { await emit(socket, 'add-player', { name, color }); $('newName').value = ''; }
  catch (e) { alert(e.message); }
});

$('startGame').addEventListener('click', async () => {
  const startingBalance = Number($('startingBalance').value);
  const passGoBonus = Number($('passGoBonus').value);
  try { await emit(socket, 'start-game', { startingBalance, passGoBonus }); }
  catch (e) { alert(e.message); }
});

$('reset').addEventListener('click', async () => {
  if (!confirm('Oyun sifirlansin mi?')) return;
  try { await emit(socket, 'reset'); } catch (e) { alert(e.message); }
});

function render(s) {
  const isSetup = s.status === 'setup';
  $('setup').hidden = !isSetup;
  $('active').hidden = isSetup;
  if (isSetup) renderSetup(s); else renderActive(s);
}

function renderSetup(s) {
  const cards = s.players.map(p => el('div', { class: 'card' }, [
    el('span', { class: 'player-chip', style: { background: p.color } }, [p.name]),
    el('p', { style: { fontSize: '11px', wordBreak: 'break-all' } }, [
      'Link: ',
      el('code', {}, [`http://${location.host}/join/${p.token}`]),
    ]),
  ]));
  replaceChildren($('players'), cards);
  $('startGame').disabled = s.players.length < 2;
}

function renderActive(s) {
  const cur = s.config.currency;
  const cards = s.players.map(p => {
    const input = el('input', { type: 'number', placeholder: '+/- miktar', id: `adj-${p.id}` });
    const btn = el('button', {
      onClick: async () => {
        const amount = Number(input.value);
        if (!amount) return;
        try { await emit(socket, 'banker-adjust', { playerId: p.id, amount }); input.value = ''; }
        catch (e) { alert(e.message); }
      }
    }, ['Uygula']);
    return el('div', { class: 'card' }, [
      el('span', { class: 'player-chip', style: { background: p.color } }, [p.name]),
      el('span', {}, [p.online ? ' ●' : ' ○']),
      el('div', { class: 'balance' }, [`${p.balance}${cur}`]),
      el('div', { class: 'row' }, [input, btn]),
    ]);
  });
  replaceChildren($('activePlayers'), cards);

  const txRows = [...s.transactions].reverse().map(t => {
    const undoBtn = t.undone ? null : el('button', {
      class: 'secondary',
      style: { float: 'right', padding: '4px 8px', fontSize: '12px' },
      onClick: async () => {
        try { await emit(socket, 'undo', { transactionId: t.id }); }
        catch (e) { alert(e.message); }
      },
    }, ['Geri Al']);
    return el('div', { class: `tx-row${t.undone ? ' undone' : ''}` }, [
      describeTx(t, s),
      ' ',
      undoBtn,
    ]);
  });
  replaceChildren($('transactions'), txRows);
}
```

- [ ] **Step 3: Manual test**

Run: `npm start`. Tarayıcıda `http://localhost:3000/banker`:
- Oyuncu ekle ("Ahmet" + renk) → kart belirir, link altında.
- İkinci oyuncu ekle → "Oyunu Baslat" butonu aktifleşir.
- Başlangıç parasını 1000'e değiştir, başlat → her oyuncu 1000.
- Bir oyuncuya `+500` uygula → bakiye 1500, akışta görünür.
- "Geri Al" → satır üstü çizilir, bakiye 1000'e döner.
- Sayfayı yenile → durum korunur.
- "Oyunu Sıfırla" → setup'a geri döner, oyuncular silinir.

- [ ] **Step 4: Commit**

```bash
git add public/banker.html public/banker.js
git commit -m "feat(banker): banker panel with setup, players, adjustments, undo"
```

---

## Task 10: Oyuncu paneli + join sayfası

**Files:**
- Create: `public/player.html`
- Create: `public/player.js`
- Create: `public/join.html`

- [ ] **Step 1: join.html (token bulunamadığında 404)**

```html
<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Katil</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <div class="card">
    <h1>Oyun bulunamadi</h1>
    <p>Bu link gecersiz veya oyun sifirlanmis. Bankacidan yeni link iste.</p>
  </div>
</body>
</html>
```

- [ ] **Step 2: player.html**

```html
<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Monopoly Bank</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <div id="loading" class="card">Yukleniyor...</div>
  <div id="noToken" class="card" hidden>
    <h1>Henuz katilmadin</h1>
    <p>Bankacinin QR kodunu telefon kamerasiyla tara veya verdigi linke tikla.</p>
  </div>
  <div id="setup" class="card" hidden>
    <h1>Oyun baslamayi bekliyor</h1>
    <p id="setupName"></p>
  </div>
  <div id="active" hidden>
    <div class="card">
      <span id="me" class="player-chip"></span>
      <div class="balance" id="balance"></div>
      <div class="row">
        <button id="sendBtn" style="flex:1">Para Gonder</button>
        <button id="goBtn" class="secondary" style="flex:1">GO'dan Gectim</button>
      </div>
    </div>
    <div class="card">
      <h2>Islem Akisi</h2>
      <div id="transactions"></div>
    </div>
  </div>
  <div id="sendModal" class="card" hidden>
    <h2>Para Gonder</h2>
    <label>Alici: <select id="recipient"></select></label>
    <label style="margin-top:8px">Miktar: <input id="amount" type="number" min="1"></label>
    <div class="row" style="margin-top:12px">
      <button id="sendCancel" class="secondary" style="flex:1">Iptal</button>
      <button id="sendConfirm" style="flex:1">Gonder</button>
    </div>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script type="module" src="/player.js"></script>
</body>
</html>
```

- [ ] **Step 3: player.js (XSS-safe)**

```javascript
import { connect, emit, describeTx } from '/socket-client.js';
import { el, replaceChildren } from '/dom.js';

const $ = (id) => document.getElementById(id);
const cookieToken = document.cookie.split('; ').find(c => c.startsWith('playerToken='))?.split('=')[1];

if (!cookieToken) {
  $('loading').hidden = true;
  $('noToken').hidden = false;
} else {
  const socket = connect();
  let me = null;
  let currentState = null;

  socket.on('state', (s) => {
    currentState = s;
    me = s.players.find(p => p.token === cookieToken);
    if (!me) {
      $('loading').hidden = true;
      $('noToken').hidden = false;
      return;
    }
    render(s);
  });

  $('goBtn').addEventListener('click', async () => {
    try { await emit(socket, 'pass-go'); } catch (e) { alert(e.message); }
  });

  $('sendBtn').addEventListener('click', () => {
    const others = currentState.players.filter(p => p.id !== me.id);
    const opts = others.map(p => el('option', { value: p.id }, [p.name]));
    replaceChildren($('recipient'), opts);
    $('amount').value = '';
    $('sendModal').hidden = false;
  });

  $('sendCancel').addEventListener('click', () => { $('sendModal').hidden = true; });

  $('sendConfirm').addEventListener('click', async () => {
    const toId = $('recipient').value;
    const amount = Number($('amount').value);
    if (!amount || amount <= 0) return alert('Gecersiz miktar');
    try {
      await emit(socket, 'transfer', { toId, amount });
      $('sendModal').hidden = true;
    } catch (e) { alert(e.message); }
  });

  function render(s) {
    $('loading').hidden = true;
    const isSetup = s.status === 'setup';
    $('setup').hidden = !isSetup;
    $('active').hidden = isSetup;
    if (isSetup) {
      $('setupName').textContent = `Sen: ${me.name}`;
      return;
    }
    $('me').textContent = me.name;
    $('me').style.background = me.color;
    $('balance').textContent = `${me.balance}${s.config.currency}`;
    $('goBtn').textContent = `GO'dan Gectim (+${s.config.passGoBonus}${s.config.currency})`;

    const rows = [...s.transactions].slice(-20).reverse().map(t =>
      el('div', { class: `tx-row${t.undone ? ' undone' : ''}` }, [describeTx(t, s)])
    );
    replaceChildren($('transactions'), rows);
  }
}
```

- [ ] **Step 4: End-to-end manual test**

Run: `npm start`. İki tarayıcı (veya tarayıcı + telefon):

1. **Bankacı tarayıcı** — `http://localhost:3000/banker` → 2 oyuncu ekle (Ahmet, Mehmet)
2. **İkinci tarayıcı/incognito** — Bankacı panelindeki Ahmet linkine git → `/player`'a yönlenir, "Oyun baslamayi bekliyor".
3. **Üçüncü tarayıcı/incognito** — Mehmet linki → ikinci oyuncu da bekliyor.
4. **Bankacı** — "Oyunu Baslat" → her iki tarayıcıda 1500₺ belirir.
5. **Ahmet** — "Para Gonder" → Mehmet → 200 → Gonder → Ahmet 1300, Mehmet 1700, anında her yerde.
6. **Mehmet** — "GO'dan Gectim" → Mehmet 1900.
7. **Bankacı** — son işlemi "Geri Al" → Mehmet 1700, çizili.
8. Ctrl+C → `npm start` → durum korunmuş, tarayıcılar otomatik tekrar bağlanır.

- [ ] **Step 5: Commit**

```bash
git add public/player.html public/player.js public/join.html
git commit -m "feat(player): player panel with transfer modal and live feed"
```

---

## Task 11: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: README**

```markdown
# Monopoly Bank

Local agda calisan Monopoly para yonetim uygulamasi. Oyuncular telefondan baglanir, bankaci bilgisayardan yonetir.

## Calistirma

\`\`\`bash
npm install
npm start
\`\`\`

Konsola yazilan `http://192.168.x.x:3000/banker` adresini bilgisayar tarayicisinda ac. Oyuncular ekle, her birinin linkini WhatsApp'tan yolla veya telefonu QR'a tut.

## Test

\`\`\`bash
npm test
\`\`\`

## Veri

`game-state.json` dosyasi proje koklerinde tutulur. Silinirse yeni oyun baslar.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```

---

## Self-Review

**Spec coverage:**
- [x] Yalnizca para — game-logic'te sadece bakiye/işlem
- [x] Direkt transfer — transfer event'i hemen uygulanir
- [x] Bankaci oyuncu olusturur + token/QR — Task 9 setup
- [x] Tam bankaci yetkisi — adjust/undo/reset hepsi var
- [x] JSON kalicilik + atomik — Task 3
- [x] Yapilandirilabilir baslangic parasi — Task 9 input
- [x] Tum islemler herkese acik — `state` event tam snapshot
- [x] Vanilla JS, build adimi yok
- [x] Hata durumlari — yetersiz bakiye, gecersiz miktar, ayni kisi, gecersiz token, cift undo

**XSS koruması:** Tüm dynamic content `el()` helper'ı + `textContent` üzerinden basılır, hiçbir yerde `innerHTML = ...` yok.

**Bilinen sınırlamalar (basit proje, kabul):**
- Bankacı authentication'ı yok — `/banker`'a kim girerse bankacı olur (local ağ varsayımı)
- Token cookie'si paylaşılırsa başkası da o oyuncu olarak girer (dürüstlük varsayımı)
- HTTPS yok — local IP üzerinde gerekmez
