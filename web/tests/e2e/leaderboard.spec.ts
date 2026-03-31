import { expect, test } from "@playwright/test";

test("global navigation and homepage routes stay clickable", async ({ page }) => {
  await page.goto("/");
  const header = page.locator("header");

  await expect(
    page.getByRole("heading", {
      name: /Benchmark agents with the calm precision/i
    })
  ).toBeVisible();

  await header.getByRole("link", { name: /^Tasks$/ }).click();
  await expect(page).toHaveURL(/\/tasks/);
  await expect(page.getByRole("heading", { name: /Benchmark worlds with clear constraints/i })).toBeVisible();

  await header.getByRole("link", { name: /^Leaderboard$/ }).click();
  await expect(page).toHaveURL(/\/leaderboard/);
  await expect(page.getByRole("heading", { name: /Rigorous benchmark rankings/i })).toBeVisible();

  await header.getByRole("link", { name: /^Upload$/ }).click();
  await expect(page).toHaveURL(/\/upload/);
  await expect(page.getByRole("heading", { name: /Publish real runs from the browser/i })).toBeVisible();

  await page.goto("/");
  await header.getByRole("link", { name: /Get Started/i }).click();
  await expect(page).toHaveURL(/\/upload/);
  await expect(page.getByRole("heading", { name: /Publish real runs from the browser/i })).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(3);
  await expect(page.getByRole("button", { name: /Create \+ Upload Run/i })).toBeVisible();

  await page.goto("/");
  await page.getByRole("link", { name: /Explore Benchmark Tasks/i }).click();
  await expect(page).toHaveURL(/\/tasks/);
  await expect(page.getByText(/Benchmark worlds with clear constraints/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /Upload Run/i }).first()).toBeVisible();

  await page.goto("/");
  await page.getByRole("link", { name: /^View Leaderboard$/ }).click();
  await expect(page).toHaveURL(/\/leaderboard/);

  await page.goto("/");
  await page.getByRole("link", { name: /^Browse tasks$/ }).click();
  await expect(page).toHaveURL(/\/tasks/);

  await page.goto("/");
  await page.getByRole("link", { name: /^Open leaderboards$/ }).click();
  await expect(page).toHaveURL(/\/leaderboard/);

  await page.goto("/");
  await page.getByRole("link", { name: /^Publish a run$/ }).click();
  await expect(page).toHaveURL(/\/upload/);
});

test("workflow tabs and tasks actions remain actionable", async ({ page }) => {
  await page.goto("/");
  const workflow = page.locator("section").filter({ hasText: /A single workflow for create, evaluate, upload, and compare/i }).first();

  await workflow.getByRole("button", { name: /^Evaluate$/ }).click();
  await expect(page.getByRole("heading", { name: /Run agents against real benchmark tracks/i })).toBeVisible();
  await workflow.getByRole("link", { name: /^Open Leaderboard$/ }).click();
  await expect(page).toHaveURL(/\/leaderboard/);

  await page.goto("/");
  await workflow.getByRole("button", { name: /^Upload$/ }).click();
  await expect(page.getByRole("heading", { name: /Push a run through the browser/i })).toBeVisible();
  await workflow.getByRole("link", { name: /^Open Upload Studio$/ }).first().click();
  await expect(page).toHaveURL(/\/upload/);

  await page.goto("/");
  await workflow.getByRole("button", { name: /^Compare$/ }).click();
  await expect(page.getByRole("heading", { name: /Turn benchmark results into something that reads like a shipped product page/i })).toBeVisible();
  await workflow.getByRole("link", { name: /Upload Comparison Run/i }).first().click();
  await expect(page).toHaveURL(/\/upload\?track=continual/);

  await page.goto("/tasks");
  await page.getByRole("link", { name: /^Upload Run$/ }).first().click();
  await expect(page).toHaveURL(/\/upload\?env=.*track=test/);

  await page.goto("/tasks");
  await page.getByRole("link", { name: /^Compare on Leaderboard$/ }).first().click();
  await expect(page).toHaveURL(/\/leaderboard/);

  await page.goto("/upload");
  await page.getByRole("link", { name: /^Compare Current Runs$/ }).click();
  await expect(page).toHaveURL(/\/leaderboard/);

  await page.goto("/upload");
  await page.getByRole("link", { name: /^Browse Benchmark Tasks$/ }).click();
  await expect(page).toHaveURL(/\/tasks/);
});

test("leaderboard and run detail pages stay navigable", async ({ page }) => {
  await page.goto("/leaderboard");

  await expect(page.getByText(/Rigorous benchmark rankings/i)).toBeVisible();
  await page.getByRole("button", { name: /^train$/i }).click();
  await page.getByRole("button", { name: /^continual$/i }).click();
  await page.getByRole("button", { name: /^test$/i }).click();
  const firstRunLink = page.locator("table tbody tr a").first();
  await expect(firstRunLink).toBeVisible({ timeout: 15000 });
  await firstRunLink.click();

  await expect(page).toHaveURL(/\/runs\//);
  await expect(page.getByText(/Run viewer/i)).toBeVisible();
  await expect(page.getByText(/Success Rate/i)).toBeVisible();
  await page.getByRole("link", { name: /Back to Leaderboard/i }).click();
  await expect(page).toHaveURL(/\/leaderboard/);

  await page.goto("/leaderboard");
  const runLinkAgain = page.locator("table tbody tr a").first();
  await runLinkAgain.click();
  await page.getByRole("link", { name: /Upload Another Run/i }).click();
  await expect(page).toHaveURL(/\/upload/);
  await page.getByRole("link", { name: /Cancel/i }).click();
  await expect(page).toHaveURL(/\/leaderboard/);
});
