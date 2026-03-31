import { expect, test } from "@playwright/test";

test("homepage routes users into tasks and upload flows", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: /Benchmark agents with the calm precision/i
    })
  ).toBeVisible();

  await page.getByRole("link", { name: /Get Started/i }).first().click();
  await expect(page).toHaveURL(/\/upload/);
  await expect(page.getByRole("heading", { name: /Publish real runs from the browser/i })).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(3);
  await expect(page.getByRole("button", { name: /Create \+ Upload Run/i })).toBeVisible();

  await page.goto("/");
  await page.getByRole("link", { name: /Explore Benchmark Tasks/i }).click();
  await expect(page).toHaveURL(/\/tasks/);
  await expect(page.getByText(/Benchmark worlds with clear constraints/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /Upload Run/i }).first()).toBeVisible();
});

test("leaderboard and run detail pages stay navigable", async ({ page }) => {
  await page.goto("/leaderboard");

  await expect(page.getByText(/Rigorous benchmark rankings/i)).toBeVisible();
  const firstRunLink = page.locator("table tbody tr a").first();
  await expect(firstRunLink).toBeVisible({ timeout: 15000 });
  await firstRunLink.click();

  await expect(page).toHaveURL(/\/runs\//);
  await expect(page.getByText(/Run viewer/i)).toBeVisible();
  await expect(page.getByText(/Success Rate/i)).toBeVisible();
});
