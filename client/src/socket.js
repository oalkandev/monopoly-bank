import { io } from 'socket.io-client';
import i18n from './i18n.js';

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
      if (ack?.ok) {
        resolve(ack);
      } else {
        // Sunucu hata mesajını ya bir i18n key (ör. "errors.insufficientBalance")
        // ya da olduğu gibi bir metin gönderir. t() key'i çevirir, key değilse aynısını döndürür.
        const raw = ack?.error ?? 'errors.unknownError';
        const translated = i18n.t(raw);
        reject(new Error(translated));
      }
    });
  });
}

const TX_LABELS = {
  transfer: 'history.tx.transfer',
  'pass-go': 'history.tx.passGo',
  'banker-credit': 'history.tx.bankerCredit',
  'banker-debit': 'history.tx.bankerDebit',
  initial: 'history.tx.initial',
};

export function describeTx(t, players) {
  const name = (id) => players.find(p => p.id === id)?.name ?? '?';
  const bank = i18n.t('common.bank');
  switch (t.type) {
    case 'transfer':       return `${name(t.from)} → ${name(t.to)}`;
    case 'pass-go':        return `${bank} → ${name(t.to)} (${i18n.t('history.tx.passGo')})`;
    case 'banker-credit':  return `${bank} → ${name(t.to)}`;
    case 'banker-debit':   return `${name(t.from)} → ${bank}`;
    case 'initial':        return `${i18n.t('history.tx.initial')} → ${name(t.to)}`;
    default: return t.type;
  }
}

export function txDirection(t, meId) {
  if (!meId) return 'neutral';
  if (t.from === meId) return 'out';
  if (t.to === meId) return 'in';
  return 'neutral';
}

export const DEFAULT_QUICK_AMOUNTS = [1, 5, 10, 50, 100, 500];
// Sunucudaki MAX_NAME_LENGTH ile aynı olmalı
export const MAX_NAME_LENGTH = 24;

export function getQuickAmounts(state) {
  const arr = state?.config?.quickAmounts;
  if (Array.isArray(arr) && arr.length > 0) return arr;
  return DEFAULT_QUICK_AMOUNTS;
}

export function formatRelative(ts) {
  const diff = Math.max(0, Date.now() - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 10) return i18n.t('common.now');
  if (sec < 60) return i18n.t('common.secondsAgo', { n: sec });
  const min = Math.floor(sec / 60);
  if (min < 60) return i18n.t('common.minutesAgo', { n: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return i18n.t('common.hoursAgo', { n: hr });
  const day = Math.floor(hr / 24);
  return i18n.t('common.daysAgo', { n: day });
}
