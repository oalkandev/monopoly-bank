import { test, expect, afterEach } from 'vitest';
import i18n from '../../client/src/i18n.js';

afterEach(() => { localStorage.clear(); });

async function languageFor(lang) {
  localStorage.setItem('monopoly-lang', lang);
  await i18n.changeLanguage(i18n.services.languageDetector.detect());
  return i18n.resolvedLanguage;
}

test('regional codes tr-TR, de-DE and fr-FR resolve to their language', async () => {
  expect(await languageFor('tr-TR')).toBe('tr');
  expect(await languageFor('de-DE')).toBe('de');
  expect(await languageFor('fr-FR')).toBe('fr');
});

test('pt-BR and pt-PT resolve to Brazilian Portuguese', async () => {
  const brazilian = i18n.t('common.bank', { lng: 'pt-BR' });
  expect(brazilian).not.toBe(i18n.t('common.bank', { lng: 'en' }));
  for (const lang of ['pt-BR', 'pt-PT']) {
    await languageFor(lang);
    expect(i18n.t('common.bank')).toBe(brazilian);
  }
});

test('an unsupported language resolves to English', async () => {
  expect(await languageFor('xx')).toBe('en');
});
