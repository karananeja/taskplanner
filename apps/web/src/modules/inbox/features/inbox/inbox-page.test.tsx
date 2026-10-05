import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeTask, people } from "@/test/fixtures";
import { renderApp } from "@/test/render";
import { fakeApi, sent } from "@/test/server";

describe("inbox", () => {
  it("opens the task from a notification and marks it read", async () => {
    const task = makeTask({ title: "task number 3" });
    fakeApi.tasks = [task];
    fakeApi.notifications = [
      { id: "n_1", type: "ASSIGNED", task: { id: task.id, title: task.title }, actor: people.jay, data: {}, readAt: null, createdAt: new Date().toISOString() },
      { id: "n_2", type: "MENTIONED", task: null, actor: people.chirag, data: { title: "Old", excerpt: "hey @Karan" }, readAt: new Date().toISOString(), createdAt: new Date().toISOString() },
    ];
    const { user } = renderApp("/w/ws_1/inbox");

    expect(await screen.findByText("assigned you to")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unread (1)" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Unread (1)" }));
    expect(screen.queryByText("hey @Karan")).not.toBeInTheDocument();

    await user.click(screen.getByText("task number 3"));
    expect(sent("POST", "/notifications/n_1/read")).toHaveLength(1);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("marks everything read and saves notification settings", async () => {
    fakeApi.notifications = [
      { id: "n_1", type: "ASSIGNED", task: null, actor: people.jay, data: { title: "A" }, readAt: null, createdAt: new Date().toISOString() },
    ];
    const { user } = renderApp("/w/ws_1/inbox");
    await user.click(await screen.findByRole("button", { name: "Mark all as read" }));
    expect(sent("POST", "/notifications/read-all")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Unread (0)" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Notification settings" }));
    await user.click(await screen.findByRole("checkbox", { name: /Mentions/ }));
    expect(sent("PATCH", "/notifications/settings")[0]?.body).toEqual({ MENTIONED: false });
  });
});
