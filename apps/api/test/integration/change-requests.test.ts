import { describe, expect, it } from "vitest";
import { workspaceWithTeam } from "../helpers";

describe("change requests", () => {
  it("turns a non-owner's edit into a request with a before/after diff", async () => {
    const { owner, member, createTask, task } = await workspaceWithTeam();
    const t = await createTask(owner, { title: "Spec" });
    const res = await member.patch(task(t.id), { baseVersion: t.version, changes: { title: "Better spec", priority: "HIGH" } });
    expect(res.body.result).toBe("requested");
    expect(res.body.task.title).toBe("Spec");
    expect(res.body.changeRequest).toMatchObject({
      status: "PENDING",
      requester: { id: member.id },
      changes: { title: "Better spec", priority: "HIGH" },
      previous: { title: "Spec", priority: "NONE" },
    });
  });

  it("applies an assignee's status change and requests the rest", async () => {
    const { owner, member, createTask, task } = await workspaceWithTeam();
    const t = await createTask(owner, { title: "Spec", assigneeIds: [member.id] });
    const res = await member.patch(task(t.id), { baseVersion: t.version, changes: { status: "TESTING", title: "Renamed" } });
    expect(res.body.result).toBe("partial");
    expect(res.body.task.status).toBe("TESTING");
    expect(res.body.changeRequest.changes).toEqual({ title: "Renamed" });
  });

  it("turns a non-assignee's drag into a request and leaves the card in place", async () => {
    const { owner, member, createTask, task } = await workspaceWithTeam();
    const t = await createTask(owner, { title: "Not yours" });
    const res = await member.post(`${task(t.id)}/move`, { status: "DONE", beforeId: null, afterId: null });
    expect(res.body.result).toBe("requested");
    const after = (await owner.get(task(t.id))).body;
    expect(after.status).toBe("TODO");
    expect(after.pendingChangeRequests[0].changes).toEqual({ status: "DONE" });
  });

  it("only owners approve, and approving applies the change once", async () => {
    const { owner, member, createTask, task } = await workspaceWithTeam();
    const t = await createTask(owner, { title: "Spec" });
    const cr = (await member.patch(task(t.id), { baseVersion: t.version, changes: { title: "Approved title" } })).body.changeRequest;
    const approve = `${task(t.id)}/change-requests/${cr.id}/approve`;
    expect((await member.post(approve)).status).toBe(403);
    const res = await owner.post(approve, { note: "Nice" });
    expect(res.body.title).toBe("Approved title");
    expect(res.body.pendingChangeRequests).toEqual([]);
    expect((await owner.post(approve)).status).toBe(409);
  });

  it("rejecting keeps the task unchanged and records the reason", async () => {
    const { owner, member, createTask, task } = await workspaceWithTeam();
    const t = await createTask(owner, { title: "Keep me" });
    const cr = (await member.patch(task(t.id), { baseVersion: t.version, changes: { title: "Nope" } })).body.changeRequest;
    const res = await owner.post(`${task(t.id)}/change-requests/${cr.id}/reject`, { note: "Out of scope" });
    expect(res.body.title).toBe("Keep me");
    const history = (await owner.get(`${task(t.id)}/activity`)).body;
    expect(history[0]).toMatchObject({ type: "change_rejected", note: "Out of scope", requesterId: member.id });
  });

  it("lets only the requester withdraw", async () => {
    const { owner, member, createTask, task } = await workspaceWithTeam();
    const t = await createTask(owner, { title: "Spec" });
    const cr = (await member.patch(task(t.id), { baseVersion: t.version, changes: { title: "Mine" } })).body.changeRequest;
    const url = `${task(t.id)}/change-requests/${cr.id}`;
    expect((await owner.delete(url)).status).toBe(404);
    const res = await member.delete(url);
    expect(res.body.pendingChangeRequests).toEqual([]);
  });

  it("marks requests with the right permissions for each viewer", async () => {
    const { owner, member, createTask, task } = await workspaceWithTeam();
    const t = await createTask(owner, { title: "Perms", assigneeIds: [member.id] });
    expect((await member.get(task(t.id))).body.permissions).toEqual({ isOwner: false, isAssignee: true, canDelete: false, canWorkOn: true });
    expect((await owner.get(task(t.id))).body.permissions).toMatchObject({ isOwner: true, canDelete: true });
  });
});
