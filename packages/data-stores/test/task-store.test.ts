import { QueryClient } from "@tp/query";
import type { TaskCard } from "@tp/shared";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type StoreHttp } from "../src/http";
import { TaskStore, groupByStatus } from "../src/task-store";

const card = (id: string, status: TaskCard["status"], position: string): TaskCard => ({
  id, title: id, status, priority: "NONE", position, clientId: null, startDate: null, endDate: null, dueDate: null,
  parent: null, createdBy: { id: "u", name: "U", email: "u@x", avatarUrl: null }, createdAt: "", assigneeIds: [],
  ownerIds: ["u"], labelIds: [], subtaskCount: 0, commentCount: 0, checklistDone: 0, checklistTotal: 0, version: 1,
});

function setup(post: StoreHttp["post"]) {
  const initial = [card("a", "TODO", "a0"), card("b", "TODO", "a1"), card("c", "DONE", "a0")];
  const http: StoreHttp = { get: vi.fn(async () => initial) as never, post, patch: vi.fn(), delete: vi.fn() };
  const store = new TaskStore(http, new QueryClient());
  store.board("w").setData(initial);
  return store;
}

describe("TaskStore.move", () => {
  it("moves the card optimistically before the server answers", async () => {
    let resolve!: (v: unknown) => void;
    const store = setup(() => new Promise((r) => (resolve = r)) as never);
    const pending = store.move("w", "a", { status: "DONE", beforeId: "c", afterId: null });
    const moved = store.board("w").getSnapshot().data!.find((t) => t.id === "a")!;
    expect(moved.status).toBe("DONE");
    expect(moved.position > "a0").toBe(true);
    resolve({ result: "applied", task: { ...moved } });
    await pending;
  });

  it("snaps back when the move becomes a change request", async () => {
    const store = setup(async () => ({ result: "requested", task: card("a", "TODO", "a0"), changeRequest: {} }) as never);
    await store.move("w", "a", { status: "DONE", beforeId: null, afterId: null });
    expect(store.board("w").getSnapshot().data!.find((t) => t.id === "a")!.status).toBe("TODO");
  });

  it("snaps back when the server rejects the move", async () => {
    const store = setup(async () => {
      throw new ApiError(403, "forbidden", "nope");
    });
    await expect(store.move("w", "a", { status: "DONE", beforeId: null, afterId: null })).rejects.toThrow("nope");
    expect(store.board("w").getSnapshot().data!.find((t) => t.id === "a")!.status).toBe("TODO");
  });
});

describe("groupByStatus", () => {
  it("groups and sorts by position", () => {
    const cols = groupByStatus([card("x", "TODO", "a2"), card("y", "TODO", "a1")], ["TODO", "DONE"]);
    expect(cols.TODO.map((t) => t.id)).toEqual(["y", "x"]);
    expect(cols.DONE).toEqual([]);
  });
});

describe("TaskStore subtasks", () => {
  it("updates the parent's subtask count on the board when adding and deleting a subtask", async () => {
    const child = { ...card("s", "TODO", "a5"), parent: { id: "a", title: "a" } };
    const http: StoreHttp = {
      get: vi.fn(async () => []) as never,
      post: vi.fn(async () => ({ ...child, description: "", checklist: [], subtasks: [], pendingChangeRequests: [], permissions: {}, updatedAt: "" })) as never,
      patch: vi.fn(),
      delete: vi.fn(async () => undefined) as never,
    };
    const store = new TaskStore(http, new QueryClient());
    store.board("w").setData([card("a", "TODO", "a0")]);
    const count = () => store.board("w").getSnapshot().data!.find((t) => t.id === "a")!.subtaskCount;

    await store.create("w", { title: "s", parentId: "a" });
    expect(count()).toBe(1);
    await store.remove("w", "s");
    expect(count()).toBe(0);
  });
});
