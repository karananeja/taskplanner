import {
  type Client as ClientDto,
  type Label as LabelDto,
  type ReviewItem,
  type TaskFieldKey,
  type WorkspaceDetail,
  type WorkspaceRole,
  createClientSchema,
  createLabelSchema,
  createWorkspaceSchema,
  deleteWorkspaceSchema,
  joinWorkspaceSchema,
  renameWorkspaceSchema,
} from "@tp/shared";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../db";
import { env } from "../env";
import { inviteCode } from "../lib/crypto";
import { badRequest, notFound } from "../lib/errors";
import { parseJson } from "../lib/json";
import { parse } from "../lib/validate";
import { ctx, requireMembership, requireWorkspaceOwner, wsCtx } from "../middleware/auth";
import { userSummary } from "../services/serialize";
import { loadMe } from "./auth";
import { docsRouter } from "./docs";
import { notificationsRouter } from "./notifications";
import { tasksRouter } from "./tasks";

export const workspacesRouter = Router();

const joinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === "test" ? 1000 : 30,
  handler: (_req, res) =>
    res.status(429).json({ error: { code: "rate_limited", message: "Too many invite codes tried. Wait a few minutes." } }),
});

workspacesRouter.post("/", async (req, res) => {
  const { user } = ctx(req);
  const { name } = parse(createWorkspaceSchema, req.body);
  const workspace = await prisma.workspace.create({
    data: { name, inviteCode: inviteCode(), memberships: { create: { userId: user.id, role: "OWNER" } } },
  });
  res.status(201).json({ workspaceId: workspace.id, me: await loadMe(user.id) });
});

workspacesRouter.post("/join", joinLimiter, async (req, res) => {
  const { user } = ctx(req);
  const { inviteCode: code } = parse(joinWorkspaceSchema, req.body);
  const workspace = await prisma.workspace.findUnique({ where: { inviteCode: code.toLowerCase() } });
  if (!workspace) throw badRequest("That invite code doesn't match any workspace. Check it and try again.", { inviteCode: "Unknown code" });
  await prisma.membership.upsert({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    update: {},
    create: { userId: user.id, workspaceId: workspace.id, role: "MEMBER" },
  });
  res.json({ workspaceId: workspace.id, me: await loadMe(user.id) });
});

// Everything below is scoped to one workspace the caller belongs to.
const scoped = Router({ mergeParams: true });
workspacesRouter.use("/:workspaceId", requireMembership, scoped);

scoped.get("/", async (req, res) => {
  const { workspace } = wsCtx(req);
  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspace.id },
    include: { memberships: { include: { user: true }, orderBy: { createdAt: "asc" } } },
  });
  const body: WorkspaceDetail = {
    id: ws.id,
    name: ws.name,
    inviteCode: ws.inviteCode,
    myRole: workspace.role,
    members: ws.memberships.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
      role: m.role as WorkspaceRole,
      joinedAt: m.createdAt.toISOString(),
    })),
  };
  res.json(body);
});

scoped.patch("/", requireWorkspaceOwner, async (req, res) => {
  const { workspace } = wsCtx(req);
  const { name } = parse(renameWorkspaceSchema, req.body);
  await prisma.workspace.update({ where: { id: workspace.id }, data: { name } });
  res.status(204).end();
});

/** Deletes the workspace and everything in it: tasks, docs, clients, labels and memberships. */
scoped.delete("/", requireWorkspaceOwner, async (req, res) => {
  const { user, workspace } = wsCtx(req);
  const { confirmName } = parse(deleteWorkspaceSchema, req.body);
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspace.id } });
  if (confirmName !== ws.name.trim()) {
    throw badRequest("Type the workspace name exactly to confirm.", { confirmName: "Doesn't match the workspace name" });
  }
  await prisma.workspace.delete({ where: { id: workspace.id } });
  res.json(await loadMe(user.id));
});

/** Pending change requests on tasks you own (every task, if you own the workspace). */
scoped.get("/review-queue", async (req, res) => {
  const { user, workspace } = wsCtx(req);
  const requests = await prisma.changeRequest.findMany({
    where: {
      status: "PENDING",
      requesterId: { not: user.id },
      task: {
        workspaceId: workspace.id,
        ...(workspace.role === "OWNER" ? {} : { owners: { some: { userId: user.id } } }),
      },
    },
    include: { requester: true, task: { select: { id: true, title: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(
    requests.map(
      (cr): ReviewItem => ({
        id: cr.id,
        task: cr.task,
        requester: userSummary(cr.requester),
        fields: Object.keys(parseJson<Record<string, unknown>>(cr.changes, {})) as TaskFieldKey[],
        createdAt: cr.createdAt.toISOString(),
      }),
    ),
  );
});

scoped.post("/invite-code", requireWorkspaceOwner, async (req, res) => {
  const { workspace } = wsCtx(req);
  const ws = await prisma.workspace.update({ where: { id: workspace.id }, data: { inviteCode: inviteCode() } });
  res.json({ inviteCode: ws.inviteCode });
});

scoped.delete("/members/:userId", requireWorkspaceOwner, async (req, res) => {
  const { user, workspace } = wsCtx(req);
  const targetId = String(req.params.userId);
  if (targetId === user.id) throw badRequest("You own this workspace, so you can't remove yourself.");
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: targetId, workspaceId: workspace.id } },
  });
  if (!membership) throw notFound("Member");
  await prisma.$transaction([
    prisma.taskAssignee.deleteMany({ where: { userId: targetId, task: { workspaceId: workspace.id } } }),
    prisma.taskOwner.deleteMany({ where: { userId: targetId, task: { workspaceId: workspace.id } } }),
    prisma.changeRequest.deleteMany({ where: { requesterId: targetId, status: "PENDING", task: { workspaceId: workspace.id } } }),
    prisma.membership.delete({ where: { id: membership.id } }),
  ]);
  res.status(204).end();
});

scoped.post("/leave", async (req, res) => {
  const { user, workspace } = wsCtx(req);
  if (workspace.role === "OWNER") throw badRequest("You own this workspace, so you can't leave it.");
  await prisma.$transaction([
    prisma.taskAssignee.deleteMany({ where: { userId: user.id, task: { workspaceId: workspace.id } } }),
    prisma.taskOwner.deleteMany({ where: { userId: user.id, task: { workspaceId: workspace.id } } }),
    prisma.membership.delete({ where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } } }),
  ]);
  res.json(await loadMe(user.id));
});

// Labels
scoped.get("/labels", async (req, res) => {
  const { workspace } = wsCtx(req);
  const labels = await prisma.label.findMany({ where: { workspaceId: workspace.id }, orderBy: { name: "asc" } });
  res.json(labels.map((l): LabelDto => ({ id: l.id, name: l.name, color: l.color })));
});

scoped.post("/labels", async (req, res) => {
  const { workspace } = wsCtx(req);
  const input = parse(createLabelSchema, req.body);
  const l = await prisma.label.create({ data: { ...input, workspaceId: workspace.id } });
  res.status(201).json({ id: l.id, name: l.name, color: l.color } satisfies LabelDto);
});

scoped.delete("/labels/:labelId", requireWorkspaceOwner, async (req, res) => {
  const { workspace } = wsCtx(req);
  const { count } = await prisma.label.deleteMany({ where: { id: String(req.params.labelId), workspaceId: workspace.id } });
  if (!count) throw notFound("Label");
  res.status(204).end();
});

// Clients
scoped.get("/clients", async (req, res) => {
  const { workspace } = wsCtx(req);
  const clients = await prisma.client.findMany({
    where: { workspaceId: workspace.id },
    include: { _count: { select: { tasks: true, docs: true } } },
    orderBy: { name: "asc" },
  });
  res.json(
    clients.map(
      (c): ClientDto => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, color: c.color, taskCount: c._count.tasks, docCount: c._count.docs }),
    ),
  );
});

scoped.post("/clients", async (req, res) => {
  const { workspace } = wsCtx(req);
  const input = parse(createClientSchema, req.body);
  const c = await prisma.client.create({
    data: { name: input.name, email: input.email || null, phone: input.phone || null, color: input.color, workspaceId: workspace.id },
  });
  res.status(201).json({ id: c.id, name: c.name, email: c.email, phone: c.phone, color: c.color, taskCount: 0, docCount: 0 } satisfies ClientDto);
});

scoped.delete("/clients/:clientId", requireWorkspaceOwner, async (req, res) => {
  const { workspace } = wsCtx(req);
  const { count } = await prisma.client.deleteMany({ where: { id: String(req.params.clientId), workspaceId: workspace.id } });
  if (!count) throw notFound("Client");
  res.status(204).end();
});

scoped.use("/tasks", tasksRouter);
scoped.use("/docs", docsRouter);
scoped.use("/notifications", notificationsRouter);
