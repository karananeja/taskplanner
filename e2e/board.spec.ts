import { card, column, dragCard, expect, pageAs, quickAdd, test, unique } from "./fixtures";

test("create a task, drag it to another column, and it stays there after reload", async ({ browser }) => {
  const page = await pageAs(browser, "karan");
  const title = unique("Deploy preview");
  await quickAdd(page, "To do", title);

  await dragCard(page, title, "In progress");
  await expect(column(page, "In progress").getByText(title)).toBeVisible();

  await page.reload();
  await expect(column(page, "In progress").getByText(title)).toBeVisible();
  await expect(column(page, "To do").getByText(title)).toHaveCount(0);
});

test("search and filters narrow the board", async ({ browser }) => {
  const page = await pageAs(browser, "karan");
  await page.getByLabel("Search tasks").fill("redirect");
  await expect(card(page, "Fix login redirect loop")).toBeVisible();
  await expect(card(page, "Validate CSV export")).toHaveCount(0);

  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByRole("combobox", { name: "Filter by label" }).click();
  await page.getByRole("option", { name: "Feature" }).click();
  await expect(card(page, "Validate CSV export")).toBeVisible();
  await expect(card(page, "Fix login redirect loop")).toHaveCount(0);
});

test("another person's changes show up without reloading", async ({ browser }) => {
  test.setTimeout(60_000);
  const karan = await pageAs(browser, "karan");
  const jay = await pageAs(browser, "jay");
  const title = unique("From Jay");
  await quickAdd(jay, "Backlog", title);

  // Karan's open board polls every 20 seconds.
  await expect(card(karan, title)).toBeVisible({ timeout: 30_000 });
});
