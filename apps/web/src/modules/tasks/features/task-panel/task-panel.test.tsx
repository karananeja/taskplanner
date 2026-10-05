import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { asOutsider, makeTask, people } from "@/test/fixtures";
import { renderWithRouter } from "@/test/render";
import { fakeApi, sent, server } from "@/test/server";
import { TaskPanel } from "./task-panel";

function open(task = makeTask({ title: "Write spec" })) {
  fakeApi.tasks = [task];
  const onClose = vi.fn();
  const utils = renderWithRouter(<TaskPanel wid="ws_1" taskId={task.id} onOpenTask={() => {}} onClose={onClose} />);
  return { ...utils, task, onClose };
}

describe("task panel: editing", () => {
  it("saves only the fields an owner changed, with the version they started from", async () => {
    const { user, task } = open();
    const title = await screen.findByLabelText("Title");
    expect(screen.getByText("All changes saved")).toBeInTheDocument();

    await user.clear(title);
    await user.type(title, "Write the spec");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Changes saved")).toBeInTheDocument();
    expect(sent("PATCH", `/tasks/${task.id}`)[0]?.body).toEqual({ baseVersion: 1, changes: { title: "Write the spec" } });
    expect(screen.getByText("All changes saved")).toBeInTheDocument();
  });

  it("lets owners pick assignees and blocks removing the last owner", async () => {
    const { user } = open();
    await screen.findByLabelText("Title");
    const owners = screen.getByRole("group", { name: "Owners" });
    await user.click(within(owners).getByRole("button", { name: /Karan Aneja/ }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("A task needs at least one owner")).toBeInTheDocument();
    expect(sent("PATCH", "")).toHaveLength(0);

    const assignees = screen.getByRole("group", { name: "Assignees" });
    const jay = within(assignees).getByRole("button", { name: /Jay Shrivastava/ });
    await user.click(jay);
    expect(jay).toHaveAttribute("aria-pressed", "true");
  });

  it("tells non-owners their edits go for approval, then shows the pending request", async () => {
    const { user } = open(makeTask({ title: "Not mine", permissions: asOutsider, ownerIds: [people.jay.id] }));
    const title = await screen.findByLabelText("Title");
    expect(screen.getByText("Owners can edit this task and approve or reject requests.")).toBeInTheDocument();

    await user.type(title, "!");
    expect(screen.getByText("Your edits will go to the owners for approval")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send for approval" }));

    expect(await screen.findByText("Sent to the task's owners for approval")).toBeInTheDocument();
    const request = await screen.findByRole("region", { name: "Pending change requests" });
    expect(within(request).getByText("Not mine!")).toBeInTheDocument();
    expect(within(request).getByRole("button", { name: "Withdraw" })).toBeInTheDocument();
    expect(within(request).queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("offers to keep or discard my edits when someone else saved first", async () => {
    const { user, task } = open();
    const title = await screen.findByLabelText("Title");
    // Someone else saves while we're typing.
    fakeApi.tasks[0] = { ...task, title: "Their title", description: "Their notes", version: 2 };

    await user.type(title, " (mine)");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Someone else updated this task.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Write spec (mine)")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Keep my edits" }));
    // My changed field stays; their other changes come in underneath.
    expect(screen.getByDisplayValue("Write spec (mine)")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Their notes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Changes saved")).toBeInTheDocument();
    expect(sent("PATCH", `/tasks/${task.id}`).at(-1)?.body).toEqual({ baseVersion: 2, changes: { title: "Write spec (mine)" } });
  });

  it("lets owners approve a pending request", async () => {
    const task = makeTask({
      title: "Old",
      pendingChangeRequests: [
        {
          id: "cr_1",
          status: "PENDING",
          requester: people.jay,
          changes: { title: "New" },
          previous: { title: "Old" },
          reviewer: null,
          reviewNote: null,
          createdAt: new Date().toISOString(),
          reviewedAt: null,
        },
      ],
    });
    server.use(
      http.post("/api/workspaces/:wid/tasks/:id/change-requests/:cr/approve", () =>
        HttpResponse.json({ ...task, title: "New", version: 2, pendingChangeRequests: [] }),
      ),
    );
    const { user } = open(task);
    const request = await screen.findByRole("region", { name: "Pending change requests" });
    expect(within(request).getByText("Jay Shrivastava")).toBeInTheDocument();
    await user.click(within(request).getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("Change approved")).toBeInTheDocument();
    expect(screen.getByDisplayValue("New")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Pending change requests" })).not.toBeInTheDocument();
  });

  it("says so when the task was deleted", async () => {
    fakeApi.tasks = [];
    renderWithRouter(<TaskPanel wid="ws_1" taskId="t_missing" onOpenTask={() => {}} onClose={() => {}} />);
    expect(await screen.findByText("This task no longer exists")).toBeInTheDocument();
  });

  it("hides delete from people who can't delete", async () => {
    open(makeTask({ permissions: asOutsider }));
    await screen.findByLabelText("Title");
    expect(screen.queryByRole("button", { name: "More actions" })).not.toBeInTheDocument();
  });
});

describe("task panel: comments", () => {
  it("autocompletes @mentions and sends the mentioned people", async () => {
    const { user, task } = open();
    const box = await screen.findByLabelText("Write a comment");
    await user.type(box, "Thanks @ja");
    const list = await screen.findByRole("listbox");
    expect(within(list).getAllByRole("option")).toHaveLength(1);
    await user.keyboard("{Enter}");
    await user.type(box, "looks good");
    expect(box).toHaveValue("Thanks @Jay Shrivastava looks good");

    await user.click(screen.getByRole("button", { name: "Comment" }));
    expect(await screen.findByText("@Jay Shrivastava", { selector: "span" })).toBeInTheDocument();
    expect(sent("POST", `/tasks/${task.id}/comments`)[0]?.body).toEqual({
      body: "Thanks @Jay Shrivastava looks good",
      mentionIds: [people.jay.id],
    });
    expect(box).toHaveValue("");
  });

  it("drops a mention whose name was deleted from the text", async () => {
    const { user, task } = open();
    const box = await screen.findByLabelText("Write a comment");
    await user.type(box, "@chi");
    await user.keyboard("{Enter}");
    await user.clear(box);
    await user.type(box, "never mind");
    await user.click(screen.getByRole("button", { name: "Comment" }));
    await screen.findByText("never mind");
    expect(sent("POST", `/tasks/${task.id}/comments`)[0]?.body).toMatchObject({ mentionIds: [] });
  });
});
