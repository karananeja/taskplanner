import { type Browser, expect, type Locator, type Page, test as base } from "@playwright/test";

/** Seeded demo accounts (see apps/api/prisma/seed.ts). */
export const USERS = {
  karan: { email: "karan@example.com", name: "Karan Aneja", state: "e2e/.auth/karan.json" }, // workspace owner
  jay: { email: "jay@example.com", name: "Jay Shrivastava", state: "e2e/.auth/jay.json" }, // member
} as const;
export const PASSWORD = "password123";

/** Unique titles so tests don't trip over each other's data in the shared database. */
export const unique = (label: string) => `${label} ${Date.now().toString(36)}`;

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function pageAs(browser: Browser, who: keyof typeof USERS) {
  const context = await browser.newContext({ storageState: USERS[who].state, viewport: { width: 1500, height: 900 }, colorScheme: "dark" });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /^Good (morning|afternoon|evening)/ })).toBeVisible();
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  return page;
}

export const column = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
export const card = (page: Page, title: string) => page.getByRole("button", { name: new RegExp(`^${escape(title)}\\.`) });
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Create a task with the column's quick-add box. */
export async function quickAdd(page: Page, columnName: string, title: string) {
  const col = column(page, columnName);
  await col.getByRole("button", { name: "Add task" }).click();
  await col.getByLabel(`New task in ${columnName}`).fill(title);
  await col.getByLabel(`New task in ${columnName}`).press("Enter");
  await expect(card(page, title)).toBeVisible();
  await col.getByLabel(`New task in ${columnName}`).press("Escape");
}

/** Drag a card into a column with real pointer events (dnd-kit needs a few intermediate moves). */
export async function dragCard(page: Page, title: string, columnName: string) {
  // Columns scroll on their own; make sure the grab point is really on the card.
  await card(page, title).scrollIntoViewIfNeeded();
  const from = await card(page, title).boundingBox();
  const to = await column(page, columnName).locator("ul").boundingBox();
  if (!from || !to) throw new Error("card or column not visible");
  await page.mouse.move(from.x + from.width / 2, from.y + 20);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + 40, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height - 30, { steps: 15 });
  await page.mouse.up();
}

export async function openTask(page: Page, title: string): Promise<Locator> {
  await card(page, title).click();
  const panel = page.getByRole("dialog");
  await expect(panel.getByLabel("Title")).toHaveValue(title);
  return panel;
}

export const test = base;
export { expect };
