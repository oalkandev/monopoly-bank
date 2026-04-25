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
    case 'transfer': return `${name(t.from)} → ${name(t.to)}: ${t.amount}${cur}`;
    case 'pass-go': return `Banka → ${name(t.to)}: ${t.amount}${cur} (GO)`;
    case 'banker-credit': return `Banka → ${name(t.to)}: ${t.amount}${cur}`;
    case 'banker-debit': return `${name(t.from)} → Banka: ${t.amount}${cur}`;
    case 'initial': return `Başlangıç → ${name(t.to)}: ${t.amount}${cur}`;
    default: return t.type;
  }
}
