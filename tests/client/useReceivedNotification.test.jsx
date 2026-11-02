import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReceivedNotification } from '../../client/src/useReceivedNotification.js';

const me = { id: 'me' };
const tx = (id, over = {}) => ({ id, type: 'transfer', from: 'other', to: 'me', amount: 5, ...over });
const game = (transactions) => ({ transactions });

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

function setup(initial) {
  return renderHook(({ state }) => useReceivedNotification(state, me), { initialProps: { state: game(initial) } });
}

test('money received before the page opened shows no notification', () => {
  const { result } = setup([tx('t1')]);
  expect(result.current.tx).toBeNull();
});

test('new incoming money shows a notification', () => {
  const { result, rerender } = setup([tx('t1')]);
  rerender({ state: game([tx('t1'), tx('t2')]) });
  expect(result.current.tx.id).toBe('t2');
});

test('money I send shows no notification', () => {
  const { result, rerender } = setup([]);
  rerender({ state: game([tx('t1', { from: 'me', to: 'other' })]) });
  expect(result.current.tx).toBeNull();
});

test('an undone payment shows no notification', () => {
  const { result, rerender } = setup([]);
  rerender({ state: game([tx('t1', { undone: true })]) });
  expect(result.current.tx).toBeNull();
});

test('when several payments arrive together the newest is shown', () => {
  const { result, rerender } = setup([tx('t1')]);
  rerender({ state: game([tx('t1'), tx('t2'), tx('t3')]) });
  expect(result.current.tx.id).toBe('t3');
});

test('the notification goes away after 5000ms', () => {
  const { result, rerender } = setup([]);
  rerender({ state: game([tx('t1')]) });
  act(() => { vi.advanceTimersByTime(4999); });
  expect(result.current.tx).not.toBeNull();
  act(() => { vi.advanceTimersByTime(1); });
  expect(result.current.tx).toBeNull();
});
