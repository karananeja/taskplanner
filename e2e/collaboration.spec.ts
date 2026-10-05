import { card, expect, openTask, pageAs, quickAdd, test, unique } from "./fixtures";

test("checklist, subtasks and comments with mentions", async ({ browser }) => {
  const page = await pageAs(browser, "karan");
  const title = unique("Launch plan");
  await quickAdd(page, "Backlog", title);
  const panel = await openTask(page, title);

  // Checklist
  const item = panel.getByLabel("New checklist item");
  await item.fill("Write release notes");
  await item.press("Enter");
  await item.fill("Tell support");
  await item.press("Enter");
  await panel.getByRole("checkbox", { name: "Write release notes" }).click();
  await expect(panel.getByText("1/2")).toBeVisible();

  // Subtask
  await panel.getByRole("button", { name: "Add subtask" }).click();
  await panel.getByLabel("Subtask title").fill("Record demo video");
  await panel.getByRole("button", { name: "Add", exact: true }).click();
  await expect(panel.getByRole("button", { name: /Record demo video/ })).toBeVisible();

  // Comment with a mention
  const box = panel.getByLabel("Write a comment");
  await box.click();
  await box.pressSequentially("Can you review @ja");
  await page.getByRole("option", { name: /Jay Shrivastava/ }).click();
  await box.pressSequentially("please");
  await panel.getByRole("button", { name: "Comment" }).click();
  await expect(panel.getByText("@Jay Shrivastava", { exact: true })).toBeVisible();

  // The board card reflects it all.
  await panel.getByRole("button", { name: "Close" }).click();
  const c = card(page, title);
  await expect(c).toContainText("1/2");
  await expect(c).toContainText("1 subtask");
  await expect(page.getByRole("button", { name: /Record demo video/ })).toContainText(title);
});

test("an owner deletes a task", async ({ browser }) => {
  const page = await pageAs(browser, "karan");
  const title = unique("Delete me");
  await quickAdd(page, "Canceled", title);
  const panel = await openTask(page, title);
  await panel.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Delete task" }).click();
  await page.getByRole("button", { name: "Delete task" }).click();
  await expect(page.getByText("Task deleted")).toBeVisible();
  await expect(card(page, title)).toHaveCount(0);
});
