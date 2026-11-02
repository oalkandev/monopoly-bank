import React from 'react';
import { test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiceList } from '../../client/src/DiceHistory.jsx';

test('history rows are newest first and an unknown player shows ?', () => {
  const state = {
    players: [{ id: 'p1', name: 'Ada', color: '#336699' }],
    diceRolls: [
      { id: 'a', ts: Date.now(), playerId: 'p1', dice: [1, 2] },
      { id: 'b', ts: Date.now(), playerId: 'ghost', dice: [3, 4] },
    ],
  };
  render(<DiceList state={state} />);
  const rows = screen.getAllByRole('listitem');
  expect(rows).toHaveLength(2);
  expect(rows[0].textContent).toContain('?');
  expect(rows[0].textContent).toContain('7');
  expect(rows[1].textContent).toContain('Ada');
  expect(rows[1].textContent).toContain('3');
});
