import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import i18n from '../../client/src/i18n.js';

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

afterEach(() => {
  cleanup();
});
