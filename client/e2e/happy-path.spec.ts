import { expect, test } from '@playwright/test';

test.skip(
  process.env['CI'] === 'true' && !process.env['RUN_E2E'],
  'E2E requires the full stack (server + client). Set RUN_E2E=true to run in CI.',
);

test('happy path: register → create board → add list → add card', async ({ page }) => {
  const email = `e2e-${Date.now()}@test.com`;

  // 1. Register a new user.
  await page.goto('/register');
  await page.getByLabel(/name/i).fill('E2E User');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill('TestPass123!');
  await page.getByRole('button', { name: /create account/i }).click();

  // 2. Should land on /boards after registration.
  await expect(page).toHaveURL(/\/boards/);

  // 3. Create a board.
  await page.getByPlaceholder(/board name/i).fill('E2E Test Board');
  await page.getByRole('button', { name: /create/i }).click();
  await expect(page.getByText('E2E Test Board')).toBeVisible();

  // 4. Navigate into the board.
  await page.getByText('E2E Test Board').click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('E2E Test Board');

  // 5. Add a list.
  await page.getByPlaceholder(/list title/i).fill('To Do');
  await page.getByRole('button', { name: /add list/i }).click();
  await expect(page.getByText('To Do')).toBeVisible();

  // 6. Add a card to the list.
  await page.getByPlaceholder(/card title/i).fill('E2E Card');
  await page.getByRole('button', { name: /add card/i }).click();
  await expect(page.getByText('E2E Card')).toBeVisible();
});
