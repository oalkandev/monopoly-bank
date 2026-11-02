import { test, expect, afterEach } from 'vitest';
import i18n from '../../client/src/i18n.js';

afterEach(() => { localStorage.clear(); });

async function languageFor(lang) {
  localStorage.setItem('monopoly-lang', lang);
  await i18n.changeLanguage(i18n.services.languageDetector.detect());
  return i18n.resolvedLanguage;
}

test('pt-PT resolves to Brazilian Portuguese and an unknown language to English', async () => {
  expect(await languageFor('pt-PT')).toBe('pt-BR');
  expect(await languageFor('xx')).toBe('en');
});

test('a plain tr code resolves to Turkish', async () => {
  expect(await languageFor('tr')).toBe('tr');
});

// Known defect: `load: 'currentOnly'` stops tr-TR and de-DE from reaching tr and de, so they show English.
// test.fails turns red when the app is fixed; then change it to a plain test.
test.fails('tr-TR resolves to Turkish', async () => {
  expect(await languageFor('tr-TR')).toBe('tr');
});
