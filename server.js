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

await state.init();
mountRoutes(app);
attachSockets(io);

httpServer.listen(PORT, '0.0.0.0', () => {
  const ip = Object.values(os.networkInterfaces())
    .flat()
    .find(i => i.family === 'IPv4' && !i.internal)?.address ?? 'localhost';
  const url = `http://${ip}:${PORT}/banker`;
  console.log(`\n🎲 Monopoly Bank hazır:\n  Bankacı: ${url}\n  Oyuncu: http://${ip}:${PORT}/player\n`);
  qrcode.generate(url, { small: true });
});
