import { column, dragCard, expect, openTask, pageAs, quickAdd, test, unique } from "./fixtures";

test("a member's edit goes to the owner, who approves it", async ({ browser }) => {
  const karan = await pageAs(browser, "karan");
  const title = unique("Owner's task");
  await quickAdd(karan, "Backlog", title);

  // Jay isn't an owner, so saving becomes a request.
  const jay = await pageAs(browser, "jay");
  let panel = await openTask(jay, title);
  await panel.getByLabel("Title").fill(`${title} (renamed)`);
  await expect(panel.getByText("Your edits will go to the owners for approval")).toBeVisible();
  await panel.getByRole("button", { name: "Send for approval" }).click();
  await expect(jay.getByText("Sent to the task's owners for approval")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Withdraw" })).toBeVisible();

  // Karan reviews it.
  await karan.reload();
  panel = await openTask(karan, title);
  const request = panel.getByRole("region", { name: "Pending change requests" });
  await expect(request).toContainText("Jay Shrivastava requested changes");
  await expect(request).toContainText(`${title} (renamed)`);
  await request.getByRole("button", { name: "Approve" }).click();
  await expect(panel.getByLabel("Title")).toHaveValue(`${title} (renamed)`);
  await expect(request).toHaveCount(0);

  await panel.getByRole("tab", { name: "History" }).click();
  await expect(panel.getByText(/requested changes to title/)).toBeVisible();
  await expect(panel.getByText(/approved a request, changing/)).toBeVisible();
});

test("the owner can reject with a reason", async ({ browser }) => {
  const karan = await pageAs(browser, "karan");
  const title = unique("Keep this name");
  await quickAdd(karan, "Backlog", title);

  const jay = await pageAs(browser, "jay");
  const jayPanel = await openTask(jay, title);
  await jayPanel.getByLabel("Title").fill("Something else");
  await jayPanel.getByRole("button", { name: "Send for approval" }).click();
  await expect(jayPanel.getByRole("button", { name: "Withdraw" })).toBeVisible();

  await karan.reload();
  const panel = await openTask(karan, title);
  await panel.getByRole("button", { name: "Reject" }).click();
  await panel.getByLabel("Reason for rejecting").fill("Name is final");
  await panel.getByRole("button", { name: "Reject" }).click();
  await expect(karan.getByText("Change rejected")).toBeVisible();
  await expect(panel.getByLabel("Title")).toHaveValue(title);
});

test("a member who isn't assigned can't move a task directly", async ({ browser }) => {
  const karan = await pageAs(browser, "karan");
  const title = unique("Owner only move");
  await quickAdd(karan, "To do", title);

  const jay = await pageAs(browser, "jay");
  await dragCard(jay, title, "Done");
  await expect(jay.getByText("Change request sent")).toBeVisible();
  // The card snaps back until an owner approves.
  await expect(column(jay, "To do").getByText(title)).toBeVisible();
  await expect(column(jay, "Done").getByText(title)).toHaveCount(0);
});

test("an assignee can move their own task", async ({ browser }) => {
  const karan = await pageAs(browser, "karan");
  const title = unique("Assigned to Jay");
  await quickAdd(karan, "To do", title);
  const panel = await openTask(karan, title);
  await panel.getByRole("group", { name: "Assignees" }).getByRole("button", { name: /Jay Shrivastava/ }).click();
  await panel.getByRole("button", { name: "Save changes" }).click();
  await expect(panel.getByText("All changes saved")).toBeVisible();

  const jay = await pageAs(browser, "jay");
  await dragCard(jay, title, "In progress");
  await expect(column(jay, "In progress").getByText(title)).toBeVisible();
  await jay.reload();
  await expect(column(jay, "In progress").getByText(title)).toBeVisible();
});
