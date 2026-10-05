import { describe, expect, it } from "vitest";
import { signUp, workspaceWithTeam } from "../helpers";

describe("workspaces", () => {
  it("makes the creator the owner and lists the workspace on /me", async () => {
    const u = await signUp("Founder");
    const res = await u.post("/workspaces", { name: "Studio" });
    expect(res.status).toBe(201);
    expect(res.body.me.workspaces).toEqual([{ id: res.body.workspaceId, name: "Studio", role: "OWNER" }]);
  });

  it("joins with an invite code, and joining twice is harmless", async () => {
    const { wid, inviteCode, member } = await workspaceWithTeam();
    const again = await member.post("/workspaces/join", { inviteCode: inviteCode.toUpperCase() });
    expect(again.status).toBe(200);
    const detail = await member.get(`/workspaces/${wid}`);
    expect(detail.body.myRole).toBe("MEMBER");
    expect(detail.body.members).toHaveLength(2);
  });

  it("rejects an unknown invite code with a field error", async () => {
    const u = await signUp("Lost");
    const res = await u.post("/workspaces/join", { inviteCode: "not-a-real-code" });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.inviteCode).toBeDefined();
  });

  it("hides a workspace from non-members with a 404", async () => {
    const { wid } = await workspaceWithTeam();
    const outsider = await signUp("Outsider");
    for (const url of [`/workspaces/${wid}`, `/workspaces/${wid}/tasks`, `/workspaces/${wid}/labels`]) {
      expect((await outsider.get(url)).status).toBe(404);
    }
  });

  it("lets only the owner rename it or rotate the invite code", async () => {
    const { owner, member, wid, inviteCode } = await workspaceWithTeam();
    expect((await member.patch(`/workspaces/${wid}`, { name: "Hijacked" })).status).toBe(403);
    expect((await member.post(`/workspaces/${wid}/invite-code`)).status).toBe(403);
    expect((await owner.patch(`/workspaces/${wid}`, { name: "Acme Inc" })).status).toBe(204);
    const rotated = await owner.post(`/workspaces/${wid}/invite-code`);
    expect(rotated.body.inviteCode).not.toBe(inviteCode);
    const late = await signUp("Late");
    expect((await late.post("/workspaces/join", { inviteCode })).status).toBe(400);
  });

  it("removing a member unassigns them and revokes access", async () => {
    const { owner, member, wid, createTask, task } = await workspaceWithTeam();
    const t = await createTask(owner, { title: "Shared", assigneeIds: [member.id] });
    expect((await owner.delete(`/workspaces/${wid}/members/${member.id}`)).status).toBe(204);
    expect((await owner.get(task(t.id))).body.assigneeIds).toEqual([]);
    expect((await member.get(`/workspaces/${wid}`)).status).toBe(404);
  });

  it("stops the owner from removing themselves or leaving", async () => {
    const { owner, wid } = await workspaceWithTeam();
    expect((await owner.delete(`/workspaces/${wid}/members/${owner.id}`)).status).toBe(400);
    expect((await owner.post(`/workspaces/${wid}/leave`)).status).toBe(400);
  });

  it("lets a member leave", async () => {
    const { member, wid } = await workspaceWithTeam();
    const res = await member.post(`/workspaces/${wid}/leave`);
    expect(res.body.workspaces).toEqual([]);
  });
});

describe("labels and clients", () => {
  it("any member adds them; only the owner deletes them", async () => {
    const { owner, member, wid } = await workspaceWithTeam();
    const label = await member.post(`/workspaces/${wid}/labels`, { name: "Bug", color: "#dc2626" });
    expect(label.status).toBe(201);
    expect((await member.delete(`/workspaces/${wid}/labels/${label.body.id}`)).status).toBe(403);
    expect((await owner.delete(`/workspaces/${wid}/labels/${label.body.id}`)).status).toBe(204);

    const client = await member.post(`/workspaces/${wid}/clients`, { name: "Northwind", email: "", color: "#ea580c" });
    expect(client.body).toMatchObject({ name: "Northwind", email: null, taskCount: 0 });
  });

  it("refuses duplicate label names and bad colours", async () => {
    const { owner, wid } = await workspaceWithTeam();
    await owner.post(`/workspaces/${wid}/labels`, { name: "Bug", color: "#dc2626" });
    expect((await owner.post(`/workspaces/${wid}/labels`, { name: "Bug", color: "#dc2626" })).status).toBe(409);
    expect((await owner.post(`/workspaces/${wid}/labels`, { name: "Red", color: "red" })).status).toBe(400);
  });

  it("deleting a client keeps its tasks", async () => {
    const { owner, wid, createTask, task } = await workspaceWithTeam();
    const client = (await owner.post(`/workspaces/${wid}/clients`, { name: "Gone", color: "#ea580c" })).body;
    const t = await createTask(owner, { title: "For client", clientId: client.id });
    await owner.delete(`/workspaces/${wid}/clients/${client.id}`);
    expect((await owner.get(task(t.id))).body.clientId).toBeNull();
  });
});
