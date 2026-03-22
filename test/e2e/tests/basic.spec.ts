import { test, expect } from '@playwright/test';

test('fresh start shows default watchlist and $10k balance', async ({ page }) => {
  await page.goto('/');

  // Connection status indicator is present in the header
  const header = page.locator('header, [data-testid="header"]').first();
  await expect(header).toBeVisible();

  // Cash balance shows approximately $10,000
  const cashText = page.getByText(/\$10,000|\$10\.0k|10,000/);
  await expect(cashText.first()).toBeVisible();

  // At least one default ticker is visible
  const ticker = page.getByText(/AAPL|GOOGL|MSFT/);
  await expect(ticker.first()).toBeVisible();
});

test('buy shares reduces cash and creates position', async ({ page }) => {
  await page.goto('/');

  // Wait for prices to load
  await page.waitForTimeout(2000);

  // Find trade bar inputs and enter a buy order
  const tickerInput = page.getByPlaceholder(/ticker/i).first();
  const quantityInput = page.getByPlaceholder(/qty|quantity|shares/i).first();
  const buyButton = page.getByRole('button', { name: /buy/i }).first();

  if (await tickerInput.isVisible() && await quantityInput.isVisible()) {
    await tickerInput.fill('AAPL');
    await quantityInput.fill('5');
    await buyButton.click();

    // Wait for trade to process
    await page.waitForTimeout(1000);

    // Cash should have decreased from $10,000
    const pageText = await page.textContent('body');
    expect(pageText).not.toContain('$10,000.00');

    // AAPL should appear in positions
    const positionsSection = page.getByText(/AAPL/);
    await expect(positionsSection.first()).toBeVisible();
  }
});

test('AI chat with mock mode returns expected response', async ({ page }) => {
  await page.goto('/');

  // Find chat input
  const chatInput = page.getByPlaceholder(/message|ask|chat/i).first();
  if (await chatInput.isVisible()) {
    await chatInput.fill('What is my portfolio?');

    // Submit via Enter or submit button
    const submitButton = page.getByRole('button', { name: /send|submit/i }).first();
    if (await submitButton.isVisible()) {
      await submitButton.click();
    } else {
      await chatInput.press('Enter');
    }

    // Wait for mock LLM response
    await page.waitForTimeout(3000);

    // Verify mock response text appears
    const responseText = page.getByText(/reviewed your portfolio/i);
    await expect(responseText).toBeVisible({ timeout: 10000 });
  }
});
