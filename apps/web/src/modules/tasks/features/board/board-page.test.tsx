import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeTask, people } from "@/test/fixtures";
import { renderApp } from "@/test/render";
import { fakeApi, sent } from "@/test/server";

const column = (name: string) => screen.getByRole("region", { name });

describe("board", () => {
  it("puts each task in its status column with counts", async () => {
    fakeApi.tasks = [
      makeTask({ title: "Plan", status: "BACKLOG" }),
      makeTask({ title: "Build", status: "IN_PROGRESS" }),
      makeTask({ title: "Test", status: "IN_PROGRESS" }),
    ];
    renderApp("/w/ws_1/tasks");
    await screen.findByText("Build");
    expect(within(column("Backlog")).getByText("Plan")).toBeInTheDocument();
    expect(within(column("In progress")).getByText("2")).toBeInTheDocument();
    expect(within(column("Done")).getByText("0")).toBeInTheDocument();
  });

  it("filters by search and assignee", async () => {
    fakeApi.tasks = [
      makeTask({ title: "Fix login", assigneeIds: [people.karan.id] }),
      makeTask({ title: "Write docs", assigneeIds: [people.jay.id] }),
      makeTask({ title: "Nobody's", assigneeIds: [] }),
    ];
    const { user } = renderApp("/w/ws_1/tasks");
    await screen.findByText("Fix login");

    await user.type(screen.getByLabelText("Search tasks"), "docs");
    expect(screen.queryByText("Fix login")).not.toBeInTheDocument();
    expect(screen.getByText("Write docs")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Clear filters/ }));
    await user.click(screen.getByRole("combobox", { name: "Filter by assignee" }));
    await user.click(await screen.findByRole("option", { name: "Unassigned" }));
    expect(screen.getByText("Nobody's")).toBeInTheDocument();
    expect(screen.queryByText("Write docs")).not.toBeInTheDocument();
  });

  it("adds a task to a column from the quick-add box", async () => {
    const { user } = renderApp("/w/ws_1/tasks");
    const testing = await screen.findByRole("region", { name: "Testing & Validation" });
    await user.click(within(testing).getByRole("button", { name: "Add task" }));
    await user.type(within(testing).getByLabelText("New task in Testing & Validation"), "Smoke test{Enter}");
    expect(await within(testing).findByText("Smoke test")).toBeInTheDocument();
    expect(sent("POST", "/tasks")[0]?.body).toEqual({ title: "Smoke test", status: "TESTING" });
  });

  it("creates a task from the dialog and opens it", async () => {
    const { user } = renderApp("/w/ws_1/tasks");
    await user.click(await screen.findByRole("button", { name: "New task" }));
    const dialog = await screen.findByRole("dialog", { name: "New task" });
    await user.click(within(dialog).getByRole("button", { name: "Create task" }));
    expect(await within(dialog).findByText("Enter a title")).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("Title"), "From dialog");
    await user.click(within(dialog).getByRole("button", { name: "Create task" }));
    expect(await screen.findByDisplayValue("From dialog")).toBeInTheDocument();
    expect(screen.getByText(/Created by Karan Aneja/)).toBeInTheDocument();
  });

  it("opens a task in the side panel from its card", async () => {
    fakeApi.tasks = [makeTask({ title: "Open me", description: "Details here" })];
    const { user } = renderApp("/w/ws_1/tasks");
    await user.click(await screen.findByRole("button", { name: /Open me/ }));
    expect(await screen.findByDisplayValue("Details here")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByDisplayValue("Details here")).not.toBeInTheDocument();
  });

  it("moves a card from its hover status menu to the bottom of the new column", async () => {
    const done = makeTask({ title: "Shipped", status: "DONE", position: "a1" });
    fakeApi.tasks = [makeTask({ title: "Quick move", position: "a0" }), done];
    const { user } = renderApp("/w/ws_1/tasks");
    await screen.findByText("Quick move");
    await user.selectOptions(screen.getByRole("combobox", { name: "Status of Quick move" }), "DONE");
    expect(await within(column("Done")).findByText("Quick move")).toBeInTheDocument();
    await waitFor(() => expect(sent("POST", "/move")[0]?.body).toEqual({ status: "DONE", beforeId: done.id, afterId: null }));
  });
});
