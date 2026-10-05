import type { Activity, AuthConfig, Client, Comment, DocDetail, Label, Me, Notification, NotificationPrefs, ReviewItem, TaskDetail, WorkspaceDetail } from "@tp/shared";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { labels as defaultLabels, makeMe, makeTask, makeWorkspace, toCard, WID } from "./fixtures";

/**
 * A small in-memory stand-in for the API, served through MSW so the real axios transport,
 * stores and query cache all run in tests. Tests arrange state with `fakeApi.*` and can
 * assert on `fakeApi.requests`, or override a route with `server.use(...)`.
 */
interface FakeApi {
  me: Me | null;
  config: AuthConfig;
  passwords: Record<string, string>;
  workspace: WorkspaceDetail;
  labels: Label[];
  clients: Client[];
  tasks: TaskDetail[];
  comments: Record<string, Comment[]>;
  activity: Record<string, Activity[]>;
  notifications: Notification[];
  notificationPrefs: NotificationPrefs;
  reviewQueue: ReviewItem[];
  docs: DocDetail[];
  requests: { method: string; path: string; body: unknown }[];
}

const initial = (): FakeApi => ({
  me: makeMe(),
  config: { google: false },
  passwords: { "karan@example.com": "password123" },
  workspace: makeWorkspace(),
  labels: [...defaultLabels],
  clients: [],
  tasks: [],
  comments: {},
  activity: {},
  notifications: [],
  notificationPrefs: { ASSIGNED: true, MENTIONED: true, CHANGE_REQUESTED: true, CHANGE_APPROVED: true, CHANGE_REJECTED: true },
  reviewQueue: [],
  docs: [],
  requests: [],
});

export let fakeApi: FakeApi = initial();
export const resetFakeApi = () => {
  fakeApi = initial();
};

const err = (status: number, code: string, message: string, extra: object = {}) =>
  HttpResponse.json({ error: { code, message, ...extra } }, { status });

const ws = `/api/workspaces/:wid`;
const findTask = (id: unknown) => fakeApi.tasks.find((t) => t.id === id);

async function record(request: Request) {
  const body = request.method === "GET" ? undefined : await request.clone().json().catch(() => undefined);
  fakeApi.requests.push({ method: request.method, path: new URL(request.url).pathname, body });
}

export const handlers = [
  http.all("*", async ({ request }) => {
    await record(request);
  }),

  http.get("/api/auth/config", () => HttpResponse.json(fakeApi.config)),
  http.get("/api/auth/me", () => (fakeApi.me ? HttpResponse.json(fakeApi.me) : err(401, "unauthorized", "Sign in to continue."))),
  http.post("/api/auth/login", async ({ request }) => {
    const { email, password } = (await request.json()) as { email: string; password: string };
    if (fakeApi.passwords[email] !== password) return err(401, "unauthorized", "That email and password don't match.");
    fakeApi.me = makeMe();
    return HttpResponse.json(fakeApi.me);
  }),
  http.post("/api/auth/logout", () => {
    fakeApi.me = null;
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(ws, ({ params }) => (params.wid === WID ? HttpResponse.json(fakeApi.workspace) : err(404, "not_found", "Workspace not found."))),
  http.get(`${ws}/labels`, () => HttpResponse.json(fakeApi.labels)),
  http.get(`${ws}/clients`, () => HttpResponse.json(fakeApi.clients)),

  http.get(`${ws}/tasks`, () => HttpResponse.json(fakeApi.tasks.map(toCard))),
  http.post(`${ws}/tasks`, async ({ request }) => {
    const body = (await request.json()) as Partial<TaskDetail> & { title: string };
    const task = makeTask({ ...body, status: body.status ?? "TODO" });
    fakeApi.tasks.push(task);
    return HttpResponse.json(task, { status: 201 });
  }),
  http.get(`${ws}/tasks/:id`, ({ params }) => {
    const t = findTask(params.id);
    return t ? HttpResponse.json(t) : err(404, "not_found", "Task not found.");
  }),
  http.patch(`${ws}/tasks/:id`, async ({ params, request }) => {
    const t = findTask(params.id);
    if (!t) return err(404, "not_found", "Task not found.");
    const { baseVersion, changes } = (await request.json()) as { baseVersion: number; changes: Partial<TaskDetail> };
    if (baseVersion !== t.version) {
      return err(409, "conflict", "Someone else saved this task while you were editing.", { currentVersion: t.version });
    }
    if (!t.permissions.isOwner) {
      const changeRequest = {
        id: `cr_${Date.now()}`,
        status: "PENDING",
        requester: fakeApi.me!.user,
        changes,
        previous: Object.fromEntries(Object.keys(changes).map((k) => [k, t[k as keyof TaskDetail]])),
        reviewer: null,
        reviewNote: null,
        createdAt: new Date().toISOString(),
        reviewedAt: null,
      } as const;
      t.pendingChangeRequests = [...t.pendingChangeRequests, changeRequest];
      return HttpResponse.json({ result: "requested", task: t, changeRequest });
    }
    Object.assign(t, changes, { version: t.version + 1 });
    return HttpResponse.json({ result: "applied", task: t });
  }),
  http.post(`${ws}/tasks/:id/move`, async ({ params, request }) => {
    const t = findTask(params.id);
    if (!t) return err(404, "not_found", "Task not found.");
    const { status } = (await request.json()) as { status: TaskDetail["status"] };
    Object.assign(t, { status });
    return HttpResponse.json({ result: "applied", task: toCard(t) });
  }),
  http.get(`${ws}/tasks/:id/comments`, ({ params }) => HttpResponse.json(fakeApi.comments[params.id as string] ?? [])),
  http.post(`${ws}/tasks/:id/comments`, async ({ params, request }) => {
    const { body, mentionIds } = (await request.json()) as { body: string; mentionIds: string[] };
    const comment: Comment = { id: `c_${Date.now()}`, body, mentionIds, author: fakeApi.me!.user, createdAt: new Date().toISOString() };
    (fakeApi.comments[params.id as string] ??= []).push(comment);
    return HttpResponse.json(comment, { status: 201 });
  }),
  http.get(`${ws}/tasks/:id/activity`, ({ params }) => HttpResponse.json(fakeApi.activity[params.id as string] ?? [])),

  http.delete(ws, async ({ request }) => {
    const { confirmName } = (await request.json()) as { confirmName: string };
    if (confirmName !== fakeApi.workspace.name) {
      return err(400, "bad_request", "Type the workspace name exactly to confirm.", { fields: { confirmName: "Doesn't match the workspace name" } });
    }
    fakeApi.me = { ...fakeApi.me!, workspaces: fakeApi.me!.workspaces.filter((w) => w.id !== WID) };
    return HttpResponse.json(fakeApi.me);
  }),
  http.get(`${ws}/review-queue`, () => HttpResponse.json(fakeApi.reviewQueue)),

  http.get(`${ws}/notifications`, () => HttpResponse.json(fakeApi.notifications)),
  http.get(`${ws}/notifications/settings`, () => HttpResponse.json(fakeApi.notificationPrefs)),
  http.patch(`${ws}/notifications/settings`, async ({ request }) => {
    Object.assign(fakeApi.notificationPrefs, await request.json());
    return HttpResponse.json(fakeApi.notificationPrefs);
  }),
  http.post(`${ws}/notifications/read-all`, () => {
    for (const n of fakeApi.notifications) n.readAt ??= new Date().toISOString();
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(`${ws}/notifications/:nid/:action`, ({ params }) => {
    const n = fakeApi.notifications.find((x) => x.id === params.nid);
    if (!n) return err(404, "not_found", "Notification not found.");
    n.readAt = params.action === "read" ? new Date().toISOString() : null;
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${ws}/docs`, () => HttpResponse.json(fakeApi.docs.map(({ body, ...d }) => (void body, d)))),
  http.post(`${ws}/docs`, async ({ request }) => {
    const input = (await request.json()) as { title: string; body?: string; clientId?: string | null };
    const now = new Date().toISOString();
    const doc: DocDetail = {
      id: `d_${fakeApi.docs.length + 1}`,
      title: input.title,
      body: input.body ?? "",
      clientId: input.clientId ?? null,
      kind: "doc",
      fileName: null,
      fileType: null,
      fileSize: null,
      createdBy: fakeApi.me!.user,
      createdAt: now,
      updatedAt: now,
    };
    fakeApi.docs.push(doc);
    return HttpResponse.json(doc, { status: 201 });
  }),
  http.get(`${ws}/docs/:id`, ({ params }) => {
    const d = fakeApi.docs.find((x) => x.id === params.id);
    return d ? HttpResponse.json(d) : err(404, "not_found", "Doc not found.");
  }),
  http.patch(`${ws}/docs/:id`, async ({ params, request }) => {
    const d = fakeApi.docs.find((x) => x.id === params.id);
    if (!d) return err(404, "not_found", "Doc not found.");
    Object.assign(d, await request.json(), { updatedAt: new Date().toISOString() });
    return HttpResponse.json(d);
  }),
];

export const server = setupServer(...handlers);

/** Requests the app sent, filtered by method and path suffix. */
export const sent = (method: string, pathEnd: string) =>
  fakeApi.requests.filter((r) => r.method === method && r.path.endsWith(pathEnd));
