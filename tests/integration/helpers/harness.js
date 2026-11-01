import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';

const ENTRY = join(dirname(fileURLToPath(import.meta.url)), 'server-entry.mjs');

/** Players carry an `online` flag that depends on open connections, not on the game. */
export function withoutOnline(state) {
  return { ...state, players: state.players.map(({ online: _online, ...rest }) => rest) };
}

function makeClient(socket) {
  const stateWaiters = [];
  const diceWaiters = [];
  socket.on('state', (s) => stateWaiters.splice(0).forEach((resolve) => resolve(s)));
  socket.on('dice-rolled', (r) => diceWaiters.splice(0).forEach((resolve) => resolve(r)));
  return {
    socket,
    call: (event, payload) => new Promise((resolve) => socket.emit(event, payload, resolve)),
    nextState: () => new Promise((resolve) => stateWaiters.push(resolve)),
    nextDice: () => new Promise((resolve) => diceWaiters.push(resolve)),
    close: () => { socket.close(); },
  };
}

function spawnServer({ port, dataFile, publicDir }) {
  const env = {
    ...process.env,
    PORT: String(port),
    MONOPOLY_TEST_DATA_FILE: dataFile,
    MONOPOLY_TEST_PUBLIC_DIR: publicDir,
  };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(process.execPath, [ENTRY], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const exited = new Promise((resolve) => child.once('exit', resolve));
  const listening = new Promise((resolve, reject) => {
    let out = '';
    child.stdout.on('data', (chunk) => {
      out += chunk;
      const m = /LISTENING (\d+)/.exec(out);
      if (m) resolve(Number(m[1]));
    });
    child.once('exit', (code, signal) => {
      reject(new Error(`server exited before listening (code ${code}, signal ${signal})\n${stderr}`));
    });
  });
  return { child, exited, listening, stderr: () => stderr };
}

/**
 * Starts the real server in a child process on a free port, with its own data file and
 * a stub public directory. Call `stop()` in an `after` hook.
 */
export async function startApp({ dataFile } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'monopoly-bank-test-'));
  const publicDir = join(dir, 'public');
  await mkdir(publicDir);
  for (const page of ['player', 'banker', 'join']) {
    await writeFile(join(publicDir, `${page}.html`), `<!doctype html><title>${page}</title>`);
  }
  const file = dataFile ?? join(dir, 'game-state.json');
  const clients = new Set();
  let server;
  const app = { dir, dataFile: file };

  async function boot(port) {
    server = spawnServer({ port, dataFile: file, publicDir });
    try {
      app.port = await server.listening;
    } catch (err) {
      console.error(server.stderr());
      throw err;
    }
    app.url = `http://127.0.0.1:${app.port}`;
  }

  async function killServer(signal) {
    server.child.kill(signal);
    await server.exited;
  }

  // Resolves once connected and the first state arrived; rejects with the connect error.
  // `options.url` overrides the address, e.g. to reach the server by its LAN IP.
  async function connect({ url = app.url, ...options } = {}) {
    const socket = io(url, { reconnection: false, forceNew: true, ...options });
    const client = makeClient(socket);
    clients.add(client);
    const first = new Promise((resolve) => socket.once('state', resolve));
    try {
      await new Promise((resolve, reject) => {
        socket.once('connect', resolve);
        socket.once('connect_error', reject);
      });
      await first;
    } catch (err) {
      socket.close();
      clients.delete(client);
      throw err;
    }
    return client;
  }

  Object.assign(app, {
    connect,
    banker: () => connect({ auth: { role: 'banker' } }),
    player: (token) => connect({ auth: { token } }),
    anon: () => connect(),
    state: async () => (await fetch(`${app.url}/api/state`)).json(),
    async startGame(names) {
      const banker = await connect({ auth: { role: 'banker' } });
      try {
        for (const name of names) {
          const ack = await banker.call('add-player', { name, color: '#123456' });
          if (!ack.ok) throw new Error(`add-player ${name}: ${ack.error}`);
        }
        const ack = await banker.call('start-game', {});
        if (!ack.ok) throw new Error(`start-game: ${ack.error}`);
      } finally {
        banker.close();
      }
      return app.state();
    },
    async kill(signal = 'SIGKILL') { await killServer(signal); },
    async restart() {
      await killServer('SIGTERM');
      await boot(app.port);
    },
    stderr: () => server.stderr(),
    async stop() {
      for (const client of clients) client.close();
      clients.clear();
      await killServer('SIGKILL');
      await rm(dir, { recursive: true, force: true });
    },
  });

  await boot(0);
  return app;
}
