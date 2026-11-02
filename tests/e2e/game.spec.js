import jsQR from 'jsqr';
import { test, expect, send, money, bankerBalance } from './helpers/app.js';

test('players join by link and a payment appears on every screen', async ({ app, banker, phone }) => {
  await banker.getByPlaceholder('Player name').fill('Ann');
  await banker.getByPlaceholder('Player name').press('Enter');
  await expect(banker.getByText('Players (1)')).toBeVisible();
  await banker.getByPlaceholder('Player name').fill('Bob');
  await banker.getByPlaceholder('Player name').press('Enter');
  await expect(banker.getByText('Players (2)')).toBeVisible();
  await banker.getByRole('button', { name: 'Start Game' }).click();

  // The banker hands each player the link shown in the QR dialog.
  const paths = {};
  for (const name of ['Ann', 'Bob']) {
    await banker.getByTestId('player-card').filter({ hasText: name }).getByRole('button', { name: 'Show QR code' }).click();
    const link = await banker.locator('code', { hasText: '/join/' }).textContent();
    paths[name] = new URL(link).pathname;
    await banker.getByRole('button', { name: 'Close' }).click();
  }
  const ann = await phone('Ann', { path: paths.Ann });
  const bob = await phone('Bob', { path: paths.Bob });
  await expect(ann.getByTestId('balance')).toHaveText(money(1500));

  await send(ann, 'Bob', 100);

  await expect(ann.getByTestId('balance')).toHaveText(money(1400));
  await expect(bob.getByTestId('balance')).toHaveText(money(1600));
  await expect(bankerBalance(banker, 'Ann')).toHaveText(money(1400));
  await expect(bankerBalance(banker, 'Bob')).toHaveText(money(1600));
  // Each phone also sees the other player's new balance.
  await expect(ann.getByText(money(1600))).toBeVisible();
  await expect(bob.getByText(money(1400))).toBeVisible();
});

test('the receiver sees a full-screen notification in the sender’s color', async ({ app, phone }) => {
  await app.setup([{ name: 'Ann', color: '#e11d48' }, { name: 'Bob', color: '#2563eb' }]);
  const ann = await phone('Ann');
  const bob = await phone('Bob');
  await expect(bob.getByTestId('balance')).toBeVisible();

  await send(ann, 'Bob', 100);

  const notice = bob.getByTestId('receive-notification');
  await expect(notice).toBeVisible();
  await expect(notice).toHaveCSS('background-color', 'rgb(225, 29, 72)');
  await expect(notice).toContainText('Ann');
  await expect(notice).toContainText('+100₺');
});

test('each QR dialog encodes that player’s own link, and the link opens that player', async ({ app, banker, phone }) => {
  await app.setup(['Ann', 'Bob']);
  for (const name of ['Ann', 'Bob']) {
    await banker.getByTestId('player-card').filter({ hasText: name }).getByRole('button', { name: 'Show QR code' }).click();
    const shown = (await banker.locator('code', { hasText: '/join/' }).textContent()).trim();
    const image = await banker.locator('canvas').evaluate((c) => {
      const { width, height } = c;
      return { width, height, data: Array.from(c.getContext('2d').getImageData(0, 0, width, height).data) };
    });
    const decoded = jsQR(Uint8ClampedArray.from(image.data), image.width, image.height);
    expect(decoded?.data).toBe(shown);

    const page = await phone(name, { path: new URL(decoded.data).pathname });
    await expect(page.getByTestId('balance')).toBeVisible();
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    await banker.getByRole('button', { name: 'Close' }).click();
  }
});

test('on a landscape phone the QR dialog’s Close button can be reached and works', async ({ app, phone }) => {
  await app.setup(['Ann', 'Bob']);
  const page = await phone('Ann', { path: '/banker', viewport: { width: 844, height: 390 } });
  await page.getByRole('button', { name: 'Show QR code' }).first().click();
  await expect(page.getByText('Point your phone camera at the QR')).toBeVisible();

  const close = page.getByRole('button', { name: 'Close' });
  await close.scrollIntoViewIfNeeded();
  await expect(close).toBeInViewport({ ratio: 1 });
  await close.click();

  await expect(page.getByText('Point your phone camera at the QR')).toBeHidden();
});

test('a rename reaches every screen, and a duplicate name shows an error', async ({ app, banker, phone }) => {
  await app.setup(['Ann', 'Bob']);
  const ann = await phone('Ann');
  const bob = await phone('Bob');
  await expect(bob.getByText('Ann', { exact: true })).toBeVisible();

  await ann.getByRole('button', { name: 'Change Your Name' }).click();
  await ann.locator('input[type=text]').fill('Annie');
  await ann.getByRole('button', { name: 'Save' }).click();

  await expect(bob.getByText('Annie', { exact: true })).toBeVisible();
  await expect(banker.getByTestId('player-card').filter({ hasText: 'Annie' })).toBeVisible();

  await bob.getByRole('button', { name: 'Change Your Name' }).click();
  await bob.locator('input[type=text]').fill('annie');
  await bob.getByRole('button', { name: 'Save' }).click();
  await expect(bob.getByText('This name is already taken')).toBeVisible();
  await expect(banker.getByTestId('player-card').filter({ hasText: 'Bob' })).toBeVisible();
});

test('the banker undoes a payment and the phone’s balance goes back', async ({ app, banker, phone }) => {
  await app.setup(['Ann', 'Bob']);
  const ann = await phone('Ann');
  await send(ann, 'Bob', 100);
  await expect(ann.getByTestId('balance')).toHaveText(money(1400));

  // The newest transaction is listed first.
  await banker.getByRole('button', { name: 'Undo' }).first().click({ force: true });

  await expect(ann.getByTestId('balance')).toHaveText(money(1500));
  await expect(bankerBalance(banker, 'Bob')).toHaveText(money(1500));
});

test('a 24-character name causes no horizontal scrolling on a phone', async ({ app, phone }) => {
  const long = 'W'.repeat(24);
  await app.setup([long, 'M'.repeat(24)]);
  const page = await phone(long);
  await expect(page.getByTestId('balance')).toBeVisible();

  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));

  expect(widths.scroll).toBeLessThanOrEqual(widths.inner);
});

test('after a reset, an open phone and its old link show a clear screen', async ({ app, banker, phone }) => {
  await app.setup(['Ann', 'Bob']);
  const oldLink = await app.linkPath('Ann');
  const ann = await phone('Ann');
  await expect(ann.getByTestId('balance')).toBeVisible();

  banker.once('dialog', (d) => d.accept());
  await banker.getByLabel('Menu').click();
  await banker.getByText('Reset Game').click();

  await expect(ann.getByText('Not joined yet')).toBeVisible();
  await ann.goto(app.url + oldLink);
  await expect(ann.getByText('Game not found')).toBeVisible();
});
