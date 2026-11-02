import { test, expect } from './helpers/app.js';

test('the dice result is hidden, then every screen shows the same total, then it closes by itself', async ({ app, banker, phone }) => {
  await app.setup(['Ann', 'Bob']);
  const ann = await phone('Ann');
  const bob = await phone('Bob');
  const screens = [banker, ann, bob];
  await expect(bob.getByTestId('balance')).toBeVisible();

  await ann.getByRole('button', { name: 'Roll Dice' }).click();

  for (const s of screens) await expect(s.getByTestId('dice-total')).toHaveText('?');
  await expect(banker.getByTestId('dice-total')).toHaveText(/^\d+$/);
  const total = await banker.getByTestId('dice-total').textContent();
  expect(Number(total)).toBeGreaterThanOrEqual(2);
  for (const s of screens) await expect(s.getByTestId('dice-total')).toHaveText(total);
  for (const s of screens) await expect(s.getByTestId('dice-total')).toBeHidden({ timeout: 10_000 });
});

test('two tabs in one browser each stay on their own player', async ({ app, banker, phone }) => {
  await app.setup(['Ann', 'Bob']);
  const first = await phone('Ann');
  await expect(first.getByTestId('balance')).toBeVisible();
  // The join link of the second player replaces the shared cookie.
  const second = await first.context().newPage();
  await second.goto(app.url + await app.linkPath('Bob'));
  await expect(second.getByText('Bob', { exact: true }).first()).toBeVisible();

  await first.getByRole('button', { name: 'Roll Dice' }).click();

  await expect(banker.getByTestId('dice-player')).toHaveText('Ann');
  await expect(first.getByTestId('dice-player')).toHaveText('Ann');
  await expect(second.getByTestId('dice-player')).toHaveText('Ann');
});
