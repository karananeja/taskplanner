import { describe, expect, it } from "vitest";
import { signUp, workspaceWithTeam } from "../helpers";

describe("checklist", () => {
  it("owners and assignees manage it; other members can't", async () => {
    const { owner, member, createTask, task } = await workspaceWithTeam();
    const t = await createTask(owner, { title: "List" });
    expect((await member.post(`${task(t.id)}/checklist`, { text: "Sneaky" })).status).toBe(403);

    const added = await owner.post(`${task(t.id)}/checklist`, { text: "Step one" });
    const item = added.body.checklist[0];
    expect(added.body).toMatchObject({ checklistTotal: 1, checklistDone: 0 });

    await owner.patch(task(t.id), { baseVersion: t.version, changes: { assigneeIds: [member.id] } });
    const ticked = await member.patch(`${task(t.id)}/checklist/${item.id}`, { done: true });
    expect(ticked.body.checklistDone).toBe(1);
    expect((await member.delete(`${task(t.id)}/checklist/${item.id}`)).body.checklist).toEqual([]);
  });
});

describe("comments and mentions", () => {
  it("any member comments; mentions keep only members named in the text", async () => {
    const { owner, member, createTask, task } = await workspaceWithTeam();
    const outsider = await signUp("Xavier");
    const t = await createTask(owner, { title: "Talk" });
    const res = await member.post(`${task(t.id)}/comments`, { body: "@Olivia can you check?", mentionIds: [owner.id, outsider.id] });
    expect(res.status).toBe(201);
    expect(res.body.mentionIds).toEqual([owner.id]);
    const card = (await owner.get(task(t.id))).body;
    expect(card.commentCount).toBe(1);
  });

  it("drops a mention whose name was edited out", async () => {
    const { owner, member, createTask, task } = await workspaceWithTeam();
    const t = await createTask(owner, { title: "Talk" });
    const res = await owner.post(`${task(t.id)}/comments`, { body: "No names here", mentionIds: [member.id] });
    expect(res.body.mentionIds).toEqual([]);
  });

  it("authors and the workspace owner can delete comments", async () => {
    const { owner, member, createTask, task } = await workspaceWithTeam();
    const t = await createTask(owner, { title: "Talk" });
    const mine = (await owner.post(`${task(t.id)}/comments`, { body: "Owner's note" })).body;
    const theirs = (await member.post(`${task(t.id)}/comments`, { body: "Member's note" })).body;
    expect((await member.delete(`${task(t.id)}/comments/${mine.id}`)).status).toBe(403);
    expect((await owner.delete(`${task(t.id)}/comments/${theirs.id}`)).status).toBe(204);
    expect((await owner.get(`${task(t.id)}/comments`)).body.map((c: { body: string }) => c.body)).toEqual(["Owner's note"]);
  });

  it("rejects empty comments", async () => {
    const { owner, createTask, task } = await workspaceWithTeam();
    const t = await createTask(owner, { title: "Talk" });
    expect((await owner.post(`${task(t.id)}/comments`, { body: "   " })).status).toBe(400);
  });
});

describe("history", () => {
  it("records each kind of change, newest first", async () => {
    const { owner, createTask, task } = await workspaceWithTeam();
    const t = await createTask(owner, { title: "Tracked" });
    await owner.patch(task(t.id), { baseVersion: t.version, changes: { priority: "LOW" } });
    await owner.post(`${task(t.id)}/checklist`, { text: "Item" });
    await owner.post(`${task(t.id)}/comments`, { body: "Hi" });
    await createTask(owner, { title: "Child", parentId: t.id });
    const types = (await owner.get(`${task(t.id)}/activity`)).body.map((a: { type: string }) => a.type);
    expect(types).toEqual(["subtask_added", "commented", "checklist_added", "updated", "created"]);
  });
});
