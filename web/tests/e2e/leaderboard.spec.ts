import { expect, test, type Page } from "@playwright/test";

/**
 * These specs are intentionally RESILIENT to marketing copy. The UI overhaul
 * rewrites headings and prose frequently, so we assert by stable contracts:
 *   - primary nav links by accessible name (route labels are stable)
 *   - the leaderboard track switcher by ARIA role="tab"
 *   - the leaderboard board by structural presence (a <table>)
 *   - run navigation by the row's role="link" into /runs/<id>
 *   - the upload form by its file inputs + a submit button
 * rather than by exact headline strings.
 */

const NAV = {
  overview: /^Overview$/,
  tasks: /^Tasks$/,
  leaderboard: /^Leaderboard$/,
  upload: /^Upload$/
};

function primaryNav(page: Page) {
  // The fixed header exposes the primary navigation landmark.
  return page.getByRole("banner").getByRole("navigation", { name: /primary/i });
}

test("primary navigation routes between the core surfaces", async ({ page }) => {
  await page.goto("/");

  const nav = primaryNav(page);

  await nav.getByRole("link", { name: NAV.tasks }).click();
  await expect(page).toHaveURL(/\/tasks/);
  // The product grid (env cards) should render, not just a hero.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await nav.getByRole("link", { name: NAV.leaderboard }).click();
  await expect(page).toHaveURL(/\/leaderboard/);

  await nav.getByRole("link", { name: NAV.upload }).click();
  await expect(page).toHaveURL(/\/upload/);

  await nav.getByRole("link", { name: NAV.overview }).click();
  await expect(page).toHaveURL(/\/$|\/$/);
});

test("home exposes a primary call to action into the upload studio", async ({
  page
}) => {
  await page.goto("/");

  // The header "Get Started" CTA targets the upload studio.
  await page
    .getByRole("banner")
    .getByRole("link", { name: /get started/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/upload/);
});

test("upload studio renders the artifact inputs and a submit control", async ({
  page
}) => {
  await page.goto("/upload");

  // Three artifact dropzones, each backed by a real file input.
  await expect(page.locator('input[type="file"]')).toHaveCount(3);

  // A submit button exists (copy may change; assert by role + a stable verb).
  await expect(
    page.getByRole("button", { name: /upload run|create.*upload|publish/i })
  ).toBeVisible();
});

test("leaderboard track switcher exposes accessible tabs", async ({ page }) => {
  await page.goto("/leaderboard");

  const tablist = page.getByRole("tablist", { name: /track/i });
  await expect(tablist).toBeVisible();

  // All three tracks are present as tabs and selectable.
  for (const track of ["test", "train", "continual"]) {
    const tab = tablist.getByRole("tab", { name: new RegExp(`^${track}$`, "i") });
    await expect(tab).toBeVisible();
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
  }
});

test("leaderboard rows navigate into a run detail view and back", async ({
  page
}) => {
  await page.goto("/leaderboard");

  // Make sure we're on a track that has seeded data.
  const tablist = page.getByRole("tablist", { name: /track/i });
  await tablist.getByRole("tab", { name: /^test$/i }).click();

  // The board renders as a table; rows are clickable links into /runs/.
  const table = page.locator("table");
  await expect(table).toBeVisible({ timeout: 15_000 });

  const firstRow = table.locator('tbody tr[role="link"]').first();
  await expect(firstRow).toBeVisible({ timeout: 15_000 });
  await firstRow.click();

  await expect(page).toHaveURL(/\/runs\//);

  // The run detail surface shows headline metrics (success rate is stable copy).
  await expect(page.getByText(/success rate/i).first()).toBeVisible();

  // And offers a path back to the leaderboard.
  await page.getByRole("link", { name: /back to leaderboard/i }).click();
  await expect(page).toHaveURL(/\/leaderboard/);
});
