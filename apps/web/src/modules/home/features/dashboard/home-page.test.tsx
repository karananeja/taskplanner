import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { todayISO } from "@/lib/dates";
import { makeTask, people } from "@/test/fixtures";
import { renderApp } from "@/test/render";
import { fakeApi } from "@/test/server";

const tile = (label: string) => screen.getByText(label).parentElement!;

describe("home", () => {
  it("counts my open, overdue and due-this-week tasks, reviews and unread notifications", async () => {
    const me = people.karan.id;
    fakeApi.tasks = [
      makeTask({ title: "Late one", assigneeIds: [me], dueDate: "2020-01-01" }),
      makeTask({ title: "Due today", assigneeIds: [me], dueDate: todayISO() }),
      makeTask({ title: "Someday", assigneeIds: [me] }),
      makeTask({ title: "Finished", assigneeIds: [me], status: "DONE", dueDate: "2020-01-01" }),
      makeTask({ title: "Jay's", assigneeIds: [people.jay.id] }),
      makeTask({ title: "Nobody's" }),
    ];
    fakeApi.reviewQueue = [
      { id: "cr_1", task: { id: "t_x", title: "Pricing page" }, requester: people.jay, fields: ["title"], createdAt: new Date().toISOString() },
    ];
    fakeApi.notifications = [
      { id: "n_1", type: "ASSIGNED", task: null, actor: people.jay, data: {}, readAt: null, createdAt: new Date().toISOString() },
    ];
    renderApp("/w/ws_1/home");

    expect(await screen.findByText("Late one")).toBeInTheDocument();
    expect(within(tile("My open tasks")).getByText("3")).toBeInTheDocument();
    expect(within(tile("Overdue")).getByText("1")).toBeInTheDocument();
    expect(within(tile("Due this week")).getByText("1")).toBeInTheDocument();
    expect(await within(tile("Awaiting your review")).findByText("1")).toBeInTheDocument();
    expect(within(tile("Unread in inbox")).getByText("1")).toBeInTheDocument();
    expect(screen.getByText("Pricing page")).toBeInTheDocument();
    expect(screen.getByText("Jay Shrivastava wants to change title")).toBeInTheDocument();
    expect(screen.getByText("Plus 1 open task with nobody assigned.")).toBeInTheDocument();
    // The sidebar shows the unread count too.
    expect(screen.getByRole("link", { name: /Inbox/ })).toHaveTextContent("1");
  });
});
