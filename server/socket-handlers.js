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

    socket.on('add-player', wrap(state.addPlayer));
    socket.on('remove-player', wrap(state.removePlayer));
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
