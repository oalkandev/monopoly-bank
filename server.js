import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import os from 'node:os';
import qrcode from 'qrcode-terminal';
import { mountRoutes } from './server/routes.js';
import { attachSockets } from './server/socket-handlers.js';
import * as state from './server/state.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

function getLanIp() {
  return Object.values(os.networkInterfaces())
    .flat()
    .find(i => i.family === 'IPv4' && !i.internal)?.address ?? 'localhost';
}

const lanIp = getLanIp();
const lanUrl = `http://${lanIp}:${PORT}`;

app.get('/api/server-info', (_req, res) => res.json({ lanUrl }));

await state.init();
mountRoutes(app);
attachSockets(io);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎲 Monopoly Bank hazır:\n  Bankacı: ${lanUrl}/banker\n  Oyuncu:  ${lanUrl}/player\n`);
  qrcode.generate(`${lanUrl}/banker`, { small: true });
});
