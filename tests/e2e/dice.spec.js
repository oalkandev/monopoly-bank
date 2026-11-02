import { test, expect } from './helpers/app.js';

const recordDiceTotals = (page) => page.evaluate(() => {
  window.__diceTotals = [];
  new MutationObserver(() => {
    const text = document.querySelector('[data-testid="dice-total"]')?.textContent;
    if (text != null && text !== window.__diceTotals.at(-1)) window.__diceTotals.push(text);
  }).observe(document.body, { subtree: true, childList: true, characterData: true });
});

test('the dice result is hidden, then every screen shows the same total, then it closes by itself', async ({ app, banker, phone }) => {
  await app.setup(['Ann', 'Bob']);
  const ann = await phone('Ann');
  const bob = await phone('Bob');
  const screens = [banker, ann, bob];
  await expect(bob.getByTestId('balance')).toBeVisible();

  for (const s of screens) await recordDiceTotals(s);

  await ann.getByRole('button', { name: 'Roll Dice' }).click();

  await expect(banker.getByTestId('dice-total')).toHaveText(/^\d+$/);
  const total = await banker.getByTestId('dice-total').textContent();
  expect(Number(total)).toBeGreaterThanOrEqual(2);
  // Each page records what it shows itself, so a slow runner cannot miss the 2-second '?'.
  for (const s of screens) await expect.poll(() => s.evaluate(() => window.__diceTotals)).toEqual(['?', total]);
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
