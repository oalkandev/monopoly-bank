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
      try {
        await fn(payload);
        if (typeof ack === 'function') ack({ ok: true });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    };

    socket.on('roll-dice', wrap(async () => {
      if (!playerId) throw new Error('Sadece oyuncular zar atabilir');
      const roll = {
        id: 'd_' + Math.random().toString(36).slice(2, 10),
        playerId,
        dice: [
          1 + Math.floor(Math.random() * 6),
          1 + Math.floor(Math.random() * 6),
        ],
        ts: Date.now(),
      };
      await state.addDiceRoll(roll);
      io.emit('dice-rolled', roll);
    }));

    socket.on('add-player', wrap(state.addPlayer));
    socket.on('remove-player', wrap(state.removePlayer));
    socket.on('start-game', wrap(state.startGame));
    socket.on('update-config', wrap(state.updateConfig));
    socket.on('pay-to-bank', wrap(async (p) => {
      if (!playerId && role !== 'banker') throw new Error('Yetkisiz');
      await state.payToBank({ playerId: playerId ?? p.playerId, amount: p.amount });
    }));
    socket.on('transfer', wrap(async (p) => {
      if (!playerId && role !== 'banker') throw new Error('Yetkisiz');
      await state.transfer({ ...p, fromId: playerId ?? p.fromId });
    }));
    socket.on('pass-go', wrap(async (p) => {
      if (role !== 'banker') throw new Error('Sadece bankacı GO bonusu verebilir');
      if (!p?.playerId) throw new Error('playerId gerekli');
      await state.passGo({ playerId: p.playerId });
    }));
    socket.on('banker-adjust', wrap(state.bankerAdjust));
    socket.on('undo', wrap(state.undo));
    socket.on('reset', wrap(state.reset));

    socket.on('disconnect', () => {
      if (playerId) state.setOnline(playerId, false);
    });
  });
}
