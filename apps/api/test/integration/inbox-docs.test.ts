import { describe, expect, it } from "vitest";
import { signUp, workspaceWithTeam } from "../helpers";

describe("deleting a workspace", () => {
  it("needs the owner and the exact name, then removes it for everyone", async () => {
    const { owner, member, wid, createTask } = await workspaceWithTeam();
    await createTask(owner, { title: "Goes away" });
    expect((await member.delete(`/workspaces/${wid}`, { confirmName: "Acme" })).status).toBe(403);
    const wrong = await owner.delete(`/workspaces/${wid}`, { confirmName: "acme" });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.fields.confirmName).toBeDefined();

    const res = await owner.delete(`/workspaces/${wid}`, { confirmName: "Acme" });
    expect(res.status).toBe(200);
    expect(res.body.workspaces).toEqual([]);
    expect((await member.get(`/workspaces/${wid}`)).status).toBe(404);
    expect((await member.get("/auth/me")).body.workspaces).toEqual([]);
  });
});

describe("inbox", () => {
  it("lists notifications for you, and marks them read one by one or all at once", async () => {
    const { owner, member, wid, createTask } = await workspaceWithTeam();
    await createTask(owner, { title: "First", assigneeIds: [member.id] });
    await createTask(owner, { title: "Second", assigneeIds: [member.id] });
    const inbox = `/workspaces/${wid}/notifications`;

    const list = await member.get(inbox);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(2);
    expect(list.body[0]).toMatchObject({ type: "ASSIGNED", task: { title: "Second" }, actor: { id: owner.id }, readAt: null });
    expect((await owner.get(inbox)).body).toEqual([]);

    expect((await member.post(`${inbox}/${list.body[0].id}/read`)).status).toBe(204);
    expect((await owner.post(`${inbox}/${list.body[1].id}/read`)).status).toBe(404);
    const afterOne = (await member.get(inbox)).body;
    expect(afterOne.filter((n: { readAt: string | null }) => !n.readAt)).toHaveLength(1);

    expect((await member.post(`${inbox}/${list.body[0].id}/unread`)).status).toBe(204);
    expect((await member.post(`${inbox}/read-all`)).status).toBe(204);
    expect((await member.get(inbox)).body.every((n: { readAt: string | null }) => n.readAt)).toBe(true);
  });

  it("respects muted notification types", async () => {
    const { owner, member, wid, createTask } = await workspaceWithTeam();
    const settings = `/workspaces/${wid}/notifications/settings`;
    expect((await member.get(settings)).body.ASSIGNED).toBe(true);
    const saved = await member.patch(settings, { ASSIGNED: false });
    expect(saved.body).toMatchObject({ ASSIGNED: false, MENTIONED: true });

    await createTask(owner, { title: "Quiet", assigneeIds: [member.id] });
    expect((await member.get(`/workspaces/${wid}/notifications`)).body).toEqual([]);
  });
});

describe("review queue", () => {
  it("shows owners the pending change requests on their tasks", async () => {
    const { owner, member, wid, createTask, task } = await workspaceWithTeam();
    const t = await createTask(owner, { title: "Owned" });
    const res = await member.patch(task(t.id), { baseVersion: t.version, changes: { title: "Renamed" } });
    expect(res.body.result).toBe("requested");

    const queue = await owner.get(`/workspaces/${wid}/review-queue`);
    expect(queue.body).toEqual([
      expect.objectContaining({ task: { id: t.id, title: "Owned" }, requester: expect.objectContaining({ id: member.id }), fields: ["title"] }),
    ]);
    expect((await member.get(`/workspaces/${wid}/review-queue`)).body).toEqual([]);
  });
});

describe("docs", () => {
  it("creates, edits, lists and deletes a written doc", async () => {
    const { owner, member, wid } = await workspaceWithTeam();
    const docs = `/workspaces/${wid}/docs`;
    const client = (await owner.post(`/workspaces/${wid}/clients`, { name: "Globex", color: "#16a34a" })).body;

    const created = await member.post(docs, { title: "Kickoff notes", body: "# Agenda", clientId: client.id });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ kind: "doc", title: "Kickoff notes", body: "# Agenda", clientId: client.id });

    const edited = await owner.patch(`${docs}/${created.body.id}`, { body: "# Agenda\n- Scope" });
    expect(edited.body.body).toBe("# Agenda\n- Scope");
    expect((await owner.get(docs)).body).toHaveLength(1);
    expect((await owner.get(`/workspaces/${wid}/clients`)).body[0].docCount).toBe(1);

    const other = await signUp("Stranger");
    expect((await other.get(`${docs}/${created.body.id}`)).status).toBe(404);
    expect((await member.post(docs, { title: "Bad", clientId: "nope" })).status).toBe(400);

    const del = await member.delete(`${docs}/${created.body.id}`);
    expect(del.status, JSON.stringify(del.body)).toBe(204);
    const after = await owner.get(docs);
    expect(after.body, `${after.status} ${JSON.stringify(after.body)}`).toEqual([]);
  });

  it("uploads a file and serves it back as a download", async () => {
    const { owner, member, wid } = await workspaceWithTeam();
    const docs = `/workspaces/${wid}/docs`;
    const content = "<script>alert(1)</script>";
    const up = await member.post(`${docs}/upload`, {
      fileName: "page.html",
      fileType: "text/html",
      dataBase64: Buffer.from(content).toString("base64"),
    });
    expect(up.status).toBe(201);
    expect(up.body).toMatchObject({ kind: "file", fileName: "page.html", fileSize: content.length });

    const file = await owner.get(`${docs}/${up.body.id}/file`);
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toContain("application/octet-stream");
    expect(file.headers["content-disposition"]).toContain("attachment");
    expect(Buffer.from(file.body).toString()).toBe(content);

    expect((await owner.patch(`${docs}/${up.body.id}`, { body: "x" })).status).toBe(400);
    // Only the uploader or the workspace owner can delete it.
    const third = await signUp("Third");
    await third.post("/workspaces/join", { inviteCode: (await owner.get(`/workspaces/${wid}`)).body.inviteCode });
    expect((await third.delete(`${docs}/${up.body.id}`)).status).toBe(403);
    expect((await owner.delete(`${docs}/${up.body.id}`)).status).toBe(204);
  });

  it("rejects files over 5 MB", async () => {
    const { member, wid } = await workspaceWithTeam();
    const big = Buffer.alloc(5 * 1024 * 1024 + 10, 1).toString("base64");
    const res = await member.post(`/workspaces/${wid}/docs/upload`, { fileName: "big.bin", dataBase64: big });
    expect(res.status).toBe(400);
  });
});
