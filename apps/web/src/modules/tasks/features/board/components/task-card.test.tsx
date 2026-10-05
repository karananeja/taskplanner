import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { labels, makeTask, makeWorkspace, people, toCard } from "@/test/fixtures";
import { type CardLookups, TaskCardView } from "./task-card";

const lookups: CardLookups = {
  members: new Map(makeWorkspace().members.map((m) => [m.id, m])),
  labels: new Map(labels.map((l) => [l.id, l])),
  clients: new Map(),
};
const renderCard = (overrides: Parameters<typeof makeTask>[0]) =>
  render(<TaskCardView task={toCard(makeTask(overrides))} lookups={lookups} />);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 30, 12));
});
afterEach(() => vi.useRealTimers());

describe("TaskCardView", () => {
  it("shows title, priority, creator and the unassigned placeholder", () => {
    renderCard({ title: "Ship it", priority: "HIGH" });
    expect(screen.getByText("Ship it")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText(/by Karan Aneja/)).toBeInTheDocument();
    expect(screen.getByTitle("Unassigned")).toBeInTheDocument();
  });

  it("flags an overdue open task", () => {
    renderCard({ dueDate: "2026-09-28", status: "IN_PROGRESS" });
    expect(screen.getByText(/Overdue/)).toHaveClass("text-destructive");
  });

  it("doesn't flag finished tasks as overdue", () => {
    renderCard({ dueDate: "2026-09-28", status: "DONE" });
    expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument();
    expect(screen.getByText(/^Due /)).toBeInTheDocument();
  });

  it("shows the parent of a subtask, checklist progress, labels and assignees", () => {
    renderCard({
      parent: { id: "p", title: "Parent task" },
      checklistDone: 1,
      checklistTotal: 3,
      labelIds: ["l_bug"],
      assigneeIds: [people.jay.id],
    });
    expect(screen.getByText("Parent task")).toBeInTheDocument();
    expect(screen.getByText("1/3")).toBeInTheDocument();
    expect(screen.getByText("Bug")).toBeInTheDocument();
    expect(screen.getByTitle("Jay Shrivastava")).toBeInTheDocument();
  });
});
