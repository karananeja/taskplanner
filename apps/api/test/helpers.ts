import request from "supertest";
import { expect } from "vitest";
import { createApp } from "../src/app";

export const app = createApp();
export const ORIGIN = "http://localhost:3000";

let counter = 0;
const unique = (name: string) =>
  `${name.toLowerCase()}-${Date.now()}-${counter++}@example.com`;

export type TestUser = Awaited<ReturnType<typeof signUp>>;

/**
 * A signed-in API client. Keeps its session cookie and sends the app's Origin like a browser would.
 * `api("/workspaces")` is relative to /api.
 */
export async function signUp(name: string, email = unique(name)) {
  const agent = request.agent(app);
  const res = await agent
    .post("/api/auth/signup")
    .set("Origin", ORIGIN)
    .send({ name, email, password: "password123" });
  expect(res.status, JSON.stringify(res.body)).toBe(201);

  const call = (
    method: "get" | "post" | "patch" | "delete",
    url: string,
    body?: unknown
  ) => {
    const r = agent[method](`/api${url}`).set("Origin", ORIGIN);
    return body === undefined ? r : r.send(body as object);
  };
  return {
    id: res.body.user.id as string,
    name,
    email,
    agent,
    get: (url: string) => call("get", url),
    post: (url: string, body: unknown = {}) => call("post", url, body),
    patch: (url: string, body: unknown) => call("patch", url, body),
    delete: (url: string, body?: unknown) => call("delete", url, body),
  };
}

/** A workspace with an owner and one member, plus shortcuts for its task URLs. */
export async function workspaceWithTeam() {
  const owner = await signUp("Olivia");
  const member = await signUp("Mo");
  const created = await owner.post("/workspaces", { name: "Acme" });
  const wid = created.body.workspaceId as string;
  const { inviteCode } = (await owner.get(`/workspaces/${wid}`)).body;
  expect((await member.post("/workspaces/join", { inviteCode })).status).toBe(
    200
  );

  const tasks = `/workspaces/${wid}/tasks`;
  const createTask = async (as: TestUser, body: Record<string, unknown>) => {
    const res = await as.post(tasks, body);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    return res.body as { id: string; version: number; [k: string]: unknown };
  };
  return {
    owner,
    member,
    wid,
    inviteCode: inviteCode as string,
    tasks,
    task: (id: string) => `${tasks}/${id}`,
    createTask,
  };
}
