import { test, expect } from 'vitest';
import { matchFilter } from '../../client/src/history.js';

test('the bank filter matches only transactions with the bank', () => {
  expect(matchFilter({ from: null, to: 'a' }, 'bank')).toBe(true);
  expect(matchFilter({ from: 'a', to: null }, 'bank')).toBe(true);
  expect(matchFilter({ from: 'a', to: 'b' }, 'bank')).toBe(false);
});

test('a player filter matches both directions', () => {
  expect(matchFilter({ from: 'a', to: 'b' }, 'player:a')).toBe(true);
  expect(matchFilter({ from: 'b', to: 'a' }, 'player:a')).toBe(true);
  expect(matchFilter({ from: 'b', to: 'c' }, 'player:a')).toBe(false);
});
