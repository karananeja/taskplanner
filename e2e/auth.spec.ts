import { expect, test } from "./fixtures";

// These start signed out.
test.use({ storageState: { cookies: [], origins: [] } });

test("a new person signs up, starts a workspace and lands on Home, then an empty board", async ({ page }) => {
  const email = `new-${Date.now()}@example.com`;
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("link", { name: "Create an account" }).click();

  await page.getByLabel("Your name").fill("Nina Patel");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: "Welcome, Nina" })).toBeVisible();
  await page.getByLabel("Workspace name").fill("Nina's team");
  await page.getByRole("button", { name: "Create workspace" }).click();

  await expect(page.getByRole("heading", { name: /^Good (morning|afternoon|evening), Nina$/ })).toBeVisible();
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  await expect(page.getByText("Nina's team")).toBeVisible();
  for (const name of ["Backlog", "To do", "In progress", "Testing & Validation", "Done", "Canceled"]) {
    await expect(page.getByRole("region", { name, exact: true })).toContainText("0");
  }

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("a teammate joins with the invite code", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Omar Diaz");
  await page.getByLabel("Work email").fill(`omar-${Date.now()}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();

  await page.getByLabel("Invite code").fill("demoinvitecode2026");
  await page.getByRole("button", { name: "Join workspace" }).click();
  await expect(page.getByText("Software", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  await expect(page.getByText("Fix login redirect loop").first()).toBeVisible();
});

test("wrong password shows a clear error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("karan@example.com");
  await page.getByLabel("Password", { exact: true }).fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toHaveText("That email and password don't match.");
});
