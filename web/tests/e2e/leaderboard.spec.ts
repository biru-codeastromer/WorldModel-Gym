import { expect, test } from "@playwright/test";

test("homepage and seeded leaderboard feel populated", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: /Evaluate long-horizon planning agents/i
    })
  ).toBeVisible();

  await page.getByRole("link", { name: /View Leaderboard/i }).click();
  await expect(page).toHaveURL(/\/leaderboard/);
  await expect(page.getByText(/Track planning quality/i)).toBeVisible();
  await expect(page.locator("table tbody tr").first()).toBeVisible();
  await expect(page.getByText("demo-mpc")).toBeVisible();

  await page.getByRole("button", { name: "train" }).click();
  await expect(page.getByText("demo-oracle")).toBeVisible();
});

test("run detail pages resolve from leaderboard links", async ({ page }) => {
  await page.goto("/leaderboard");

  const firstRunLink = page.locator("table tbody tr a").first();
  await expect(firstRunLink).toBeVisible();
  await firstRunLink.click();

  await expect(page).toHaveURL(/\/runs\//);
  await expect(page.getByText(/Run Viewer/i)).toBeVisible();
  await expect(page.getByText(/Success Rate/i)).toBeVisible();
});
