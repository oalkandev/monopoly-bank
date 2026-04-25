import { io } from 'socket.io-client';

function getCookie(name) {
  return document.cookie.split('; ').find(c => c.startsWith(name + '='))?.split('=')[1];
}

export function createSocket({ role } = {}) {
  const auth = role === 'banker'
    ? { role: 'banker' }
    : { token: getCookie('playerToken') };
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

export function describeTx(t, players) {
  const name = (id) => players.find(p => p.id === id)?.name ?? '?';
  switch (t.type) {
    case 'transfer': return `${name(t.from)} → ${name(t.to)}`;
    case 'pass-go': return `Banka → ${name(t.to)} (GO)`;
    case 'banker-credit': return `Banka → ${name(t.to)}`;
    case 'banker-debit': return `${name(t.from)} → Banka`;
    case 'initial': return `Başlangıç → ${name(t.to)}`;
    default: return t.type;
  }
}

export function txDirection(t, meId) {
  if (!meId) return 'neutral';
  if (t.from === meId) return 'out';
  if (t.to === meId) return 'in';
  return 'neutral';
}

export function formatRelative(ts) {
  const diff = Math.max(0, Date.now() - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 10) return 'şimdi';
  if (sec < 60) return `${sec}s önce`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}sa önce`;
  const day = Math.floor(hr / 24);
  return `${day}g önce`;
}
