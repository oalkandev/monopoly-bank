import React from 'react';
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { DiceNotification } from '../../client/src/DiceNotification.jsx';

const players = [{ id: 'p1', name: 'Ada', color: '#336699' }];
const roll = { key: 'r1', ts: 1, playerId: 'p1', dice: [3, 4] };

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

const advance = (ms) => act(() => { vi.advanceTimersByTime(ms); });

test('the total stays hidden until the roll ends', () => {
  render(<DiceNotification roll={roll} players={players} onClose={() => {}} />);
  advance(1999);
  expect(screen.getByTestId('dice-total').textContent).toBe('?');
  advance(1);
  expect(screen.getByTestId('dice-total').textContent).toBe('7');
});

test('the notification closes itself 5300ms after the roll', () => {
  const onClose = vi.fn();
  render(<DiceNotification roll={roll} players={players} onClose={onClose} />);
  advance(5299);
  expect(onClose).toHaveBeenCalledTimes(0);
  advance(1);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('re-rendering with a new onClose does not restart the timer', () => {
  const onClose = vi.fn();
  const { rerender } = render(<DiceNotification roll={roll} players={players} onClose={() => {}} />);
  for (let i = 0; i < 3; i++) {
    advance(1000);
    rerender(<DiceNotification roll={roll} players={players} onClose={i === 2 ? onClose : () => {}} />);
  }
  advance(2299);
  expect(onClose).toHaveBeenCalledTimes(0);
  advance(1);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('a new roll hides the total again and restarts the timer', () => {
  const onClose = vi.fn();
  const { rerender } = render(<DiceNotification roll={roll} players={players} onClose={onClose} />);
  advance(2500);
  expect(screen.getByTestId('dice-total').textContent).toBe('7');
  rerender(<DiceNotification roll={{ key: 'r2', ts: 2, playerId: 'p1', dice: [1, 2] }} players={players} onClose={onClose} />);
  expect(screen.getByTestId('dice-total').textContent).toBe('?');
  advance(2000);
  expect(screen.getByTestId('dice-total').textContent).toBe('3');
  advance(3299);
  expect(onClose).toHaveBeenCalledTimes(0);
  advance(1);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('tapping the card closes the notification', () => {
  const onClose = vi.fn();
  render(<DiceNotification roll={roll} players={players} onClose={onClose} />);
  fireEvent.click(screen.getByTestId('dice-player'));
  expect(onClose).toHaveBeenCalledTimes(1);
});
