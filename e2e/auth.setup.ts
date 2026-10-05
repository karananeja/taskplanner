import { expect, test } from "@playwright/test";
import { signIn, USERS } from "./fixtures";

// Sign in once per demo user and reuse the session cookie in every test.
for (const [who, u] of Object.entries(USERS)) {
  test(`sign in as ${who}`, async ({ page }) => {
    await signIn(page, u.email);
    await expect(page.getByRole("heading", { name: /^Good (morning|afternoon|evening)/ })).toBeVisible();
    await page.context().storageState({ path: u.state });
  });
}
