import { test, expect, vi, afterEach } from 'vitest';
import i18n from '../../client/src/i18n.js';
import { emit, formatRelative, getQuickAmounts, DEFAULT_QUICK_AMOUNTS } from '../../client/src/socket.js';

afterEach(() => { vi.useRealTimers(); });

test('emit rejects with the error text in the current language', async () => {
  const socket = { emit: (event, payload, ack) => ack({ ok: false, error: 'errors.insufficientBalance' }) };
  await i18n.changeLanguage('en');
  const en = await emit(socket, 'x', {}).catch((e) => e.message);
  await i18n.changeLanguage('tr');
  const tr = await emit(socket, 'x', {}).catch((e) => e.message);
  expect(en).toBe(i18n.t('errors.insufficientBalance', { lng: 'en' }));
  expect(tr).toBe(i18n.t('errors.insufficientBalance', { lng: 'tr' }));
  expect(en).not.toBe(tr);
});

test('relative time changes unit at 10 seconds, 60 seconds, 60 minutes and 24 hours', () => {
  vi.useFakeTimers();
  vi.setSystemTime(10_000_000_000);
  const ago = (s) => formatRelative(Date.now() - s * 1000);
  const key = (s) => ago(s);
  expect(key(9)).toBe(i18n.t('common.now'));
  expect(key(10)).toBe(i18n.t('common.secondsAgo', { n: 10 }));
  expect(key(59)).toBe(i18n.t('common.secondsAgo', { n: 59 }));
  expect(key(60)).toBe(i18n.t('common.minutesAgo', { n: 1 }));
  expect(key(3599)).toBe(i18n.t('common.minutesAgo', { n: 59 }));
  expect(key(3600)).toBe(i18n.t('common.hoursAgo', { n: 1 }));
  expect(key(86399)).toBe(i18n.t('common.hoursAgo', { n: 23 }));
  expect(key(86400)).toBe(i18n.t('common.daysAgo', { n: 1 }));
});

test('quick amounts fall back to the defaults when the game has none', () => {
  expect(getQuickAmounts({ config: {} })).toEqual(DEFAULT_QUICK_AMOUNTS);
  expect(getQuickAmounts({ config: { quickAmounts: [] } })).toEqual(DEFAULT_QUICK_AMOUNTS);
  expect(getQuickAmounts(null)).toEqual(DEFAULT_QUICK_AMOUNTS);
  expect(getQuickAmounts({ config: { quickAmounts: [7, 9] } })).toEqual([7, 9]);
});
