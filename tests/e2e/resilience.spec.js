import { test, expect, send, money, bankerBalance, withCuttableConnection } from './helpers/app.js';

test('after the server restarts, phones reconnect with the right balances and can keep playing', async ({ app, banker, phone }) => {
  await app.setup(['Ann', 'Bob']);
  const ann = await phone('Ann');
  const bob = await phone('Bob');
  await send(ann, 'Bob', 100);
  await expect(bob.getByTestId('balance')).toHaveText(money(1600));

  await app.restart();

  await expect(ann.getByText('Offline')).toBeHidden({ timeout: 20_000 });
  await expect(bankerBalance(banker, 'Bob')).toHaveText(money(1600), { timeout: 20_000 });
  await expect(ann.getByTestId('balance')).toHaveText(money(1400));
  await expect(bob.getByTestId('balance')).toHaveText(money(1600));

  await send(bob, 'Ann', 50);

  await expect(ann.getByTestId('balance')).toHaveText(money(1450));
  await expect(bankerBalance(banker, 'Bob')).toHaveText(money(1550));
});

test('a phone that was offline during a payment shows the current balance when it returns', async ({ app, phone }) => {
  const bankerSocket = await app.setup(['Ann', 'Bob']);
  const ann = await phone('Ann');
  const connection = await withCuttableConnection(ann);
  await expect(ann.getByTestId('balance')).toHaveText(money(1500));

  await connection.cut();
  await expect(ann.getByText('Offline')).toBeVisible({ timeout: 15_000 });
  const me = (await app.state()).players.find((p) => p.name === 'Ann');
  const ack = await app.call(bankerSocket, 'banker-adjust', { playerId: me.id, amount: 100 });
  expect(ack.ok).toBe(true);
  connection.restore();

  await expect(ann.getByTestId('balance')).toHaveText(money(1600), { timeout: 15_000 });
});
