import { describe, expect, it } from "vitest";
import { signUp, workspaceWithTeam } from "../helpers";

describe("creating tasks", () => {
  it("makes the creator an owner and puts the task at the end of its column", async () => {
    const { owner, member, createTask, tasks } = await workspaceWithTeam();
    const a = await createTask(member, { title: "First", status: "BACKLOG" });
    const b = await createTask(member, { title: "Second", status: "BACKLOG" });
    expect(a.ownerIds).toEqual([member.id]);
    expect((a.permissions as { isOwner: boolean }).isOwner).toBe(true);
    const board = (await owner.get(tasks)).body as { id: string; status: string }[];
    expect(board.filter((t) => t.status === "BACKLOG").map((t) => t.id)).toEqual([a.id, b.id]);
  });

  it("won't assign people from outside the workspace", async () => {
    const { owner, tasks } = await workspaceWithTeam();
    const outsider = await signUp("Xavier");
    expect((await owner.post(tasks, { title: "x", assigneeIds: [outsider.id] })).status).toBe(400);
  });

  it("won't use another workspace's label", async () => {
    const { owner, tasks } = await workspaceWithTeam();
    const other = await workspaceWithTeam();
    const foreign = (await other.owner.post(`/workspaces/${other.wid}/labels`, { name: "Theirs", color: "#dc2626" })).body;
    expect((await owner.post(tasks, { title: "x", labelIds: [foreign.id] })).status).toBe(400);
  });

  it("validates fields and date order", async () => {
    const { owner, tasks } = await workspaceWithTeam();
    const res = await owner.post(tasks, { title: " ", startDate: "2026-10-10", endDate: "2026-10-01", priority: "URGENT" });
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toHaveProperty("title");
    expect(res.body.error.fields).toHaveProperty("priority");
  });

  it("keeps subtasks one level deep and shows the parent on the card", async () => {
    const { owner, createTask, tasks } = await workspaceWithTeam();
    const parent = await createTask(owner, { title: "Parent" });
    const sub = await createTask(owner, { title: "Child", parentId: parent.id });
    expect(sub.parent).toEqual({ id: parent.id, title: "Parent" });
    expect((await owner.post(tasks, { title: "Grandchild", parentId: sub.id })).status).toBe(400);
  });

  it("hides tasks from other workspaces even by id", async () => {
    const { owner, createTask } = await workspaceWithTeam();
    const t = await createTask(owner, { title: "Secret" });
    const other = await workspaceWithTeam();
    expect((await other.owner.get(`/workspaces/${other.wid}/tasks/${t.id}`)).status).toBe(404);
  });
});

describe("editing tasks", () => {
  it("applies an owner's edit directly and bumps the version", async () => {
    const { owner, createTask, task } = await workspaceWithTeam();
    const t = await createTask(owner, { title: "Spec" });
    const res = await owner.patch(task(t.id), { baseVersion: t.version, changes: { priority: "HIGH", dueDate: "2026-10-05" } });
    expect(res.body.result).toBe("applied");
    expect(res.body.task).toMatchObject({ priority: "HIGH", dueDate: "2026-10-05", version: t.version + 1 });
  });

  it("treats a save with no real differences as a no-op", async () => {
    const { owner, createTask, task } = await workspaceWithTeam();
    const t = await createTask(owner, { title: "Same" });
    const res = await owner.patch(task(t.id), { baseVersion: t.version, changes: { title: "Same" } });
    expect(res.body.result).toBe("applied");
    expect(res.body.task.version).toBe(t.version);
  });

  it("rejects a save based on an outdated version", async () => {
    const { owner, createTask, task } = await workspaceWithTeam();
    const t = await createTask(owner, { title: "Race" });
    await owner.patch(task(t.id), { baseVersion: t.version, changes: { title: "Race 2" } });
    const stale = await owner.patch(task(t.id), { baseVersion: t.version, changes: { title: "Race 3" } });
    expect(stale.status).toBe(409);
    expect(stale.body.error.currentVersion).toBe(t.version + 1);
  });

  it("requires at least one owner", async () => {
    const { owner, createTask, task } = await workspaceWithTeam();
    const t = await createTask(owner, { title: "Orphan" });
    const res = await owner.patch(task(t.id), { baseVersion: t.version, changes: { ownerIds: [] } });
    expect(res.status).toBe(400);
    expect(res.body.error.fields["changes.ownerIds"]).toBeDefined();
  });

  it("lets the workspace owner act as owner on anyone's task", async () => {
    const { owner, member, createTask, task } = await workspaceWithTeam();
    const t = await createTask(member, { title: "Mine" });
    const res = await owner.patch(task(t.id), { baseVersion: t.version, changes: { title: "Edited by boss" } });
    expect(res.body.result).toBe("applied");
  });

  it("only owners can delete, and deleting removes subtasks", async () => {
    const { owner, member, createTask, task, tasks } = await workspaceWithTeam();
    const t = await createTask(owner, { title: "Doomed", assigneeIds: [member.id] });
    await createTask(owner, { title: "Doomed child", parentId: t.id });
    expect((await member.delete(task(t.id))).status).toBe(403);
    expect((await owner.delete(task(t.id))).status).toBe(204);
    const board = (await owner.get(tasks)).body as { title: string }[];
    expect(board.map((x) => x.title)).not.toContain("Doomed child");
  });
});

describe("moving tasks", () => {
  it("orders a card between the neighbours it was dropped between", async () => {
    const { owner, createTask, task, tasks } = await workspaceWithTeam();
    const [a, b, c] = [await createTask(owner, { title: "A" }), await createTask(owner, { title: "B" }), await createTask(owner, { title: "C" })];
    await owner.post(`${task(c.id)}/move`, { status: "TODO", beforeId: a.id, afterId: b.id });
    const board = (await owner.get(tasks)).body as { id: string; status: string }[];
    expect(board.filter((t) => t.status === "TODO").map((t) => t.id)).toEqual([a.id, c.id, b.id]);
  });

  it("lets an assignee move a task to another column and logs it", async () => {
    const { owner, member, createTask, task } = await workspaceWithTeam();
    const t = await createTask(owner, { title: "Work", assigneeIds: [member.id] });
    const res = await member.post(`${task(t.id)}/move`, { status: "IN_PROGRESS", beforeId: null, afterId: null });
    expect(res.body).toMatchObject({ result: "applied", task: { status: "IN_PROGRESS" } });
    const history = (await owner.get(`${task(t.id)}/activity`)).body;
    expect(history[0]).toMatchObject({ type: "moved", from: "TODO", to: "IN_PROGRESS" });
  });

  it("lets any member reorder within a column", async () => {
    const { owner, member, createTask, task } = await workspaceWithTeam();
    const a = await createTask(owner, { title: "A" });
    const b = await createTask(owner, { title: "B" });
    const res = await member.post(`${task(b.id)}/move`, { status: "TODO", beforeId: null, afterId: a.id });
    expect(res.body.result).toBe("applied");
  });

  it("falls back to the end of the column when neighbours are gone", async () => {
    const { owner, createTask, task } = await workspaceWithTeam();
    const a = await createTask(owner, { title: "A", status: "DONE" });
    const res = await owner.post(`${task(a.id)}/move`, { status: "TESTING", beforeId: "missing", afterId: "also-missing" });
    expect(res.body.task.status).toBe("TESTING");
  });
});
