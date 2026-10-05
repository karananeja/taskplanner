import {
  NOTIFICATION_TYPES,
  type Notification as NotificationDto,
  type NotificationPrefs,
  type NotificationType,
  notificationPrefsSchema,
} from "@tp/shared";
import { Router } from "express";
import { prisma } from "../db";
import { notFound } from "../lib/errors";
import { parseJson } from "../lib/json";
import { parse } from "../lib/validate";
import { wsCtx } from "../middleware/auth";
import { userSummary } from "../services/serialize";

/** The signed-in person's Inbox for one workspace. Mounted under /workspaces/:workspaceId/notifications. */
export const notificationsRouter = Router({ mergeParams: true });

const INBOX_LIMIT = 200;

function prefsFrom(raw: string): NotificationPrefs {
  const saved = parseJson<Partial<NotificationPrefs>>(raw, {});
  return Object.fromEntries(NOTIFICATION_TYPES.map((t) => [t, saved[t] !== false])) as NotificationPrefs;
}

notificationsRouter.get("/", async (req, res) => {
  const { user, workspace } = wsCtx(req);
  const rows = await prisma.notification.findMany({
    where: { userId: user.id, workspaceId: workspace.id },
    include: { actor: true, task: { select: { id: true, title: true } } },
    orderBy: { createdAt: "desc" },
    take: INBOX_LIMIT,
  });
  res.json(
    rows.map(
      (n): NotificationDto => ({
        id: n.id,
        type: n.type as NotificationType,
        task: n.task,
        actor: n.actor ? userSummary(n.actor) : null,
        data: parseJson(n.data, {}),
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      }),
    ),
  );
});

notificationsRouter.post("/read-all", async (req, res) => {
  const { user, workspace } = wsCtx(req);
  await prisma.notification.updateMany({
    where: { userId: user.id, workspaceId: workspace.id, readAt: null },
    data: { readAt: new Date() },
  });
  res.status(204).end();
});

notificationsRouter.get("/settings", async (req, res) => {
  const { user, workspace } = wsCtx(req);
  const m = await prisma.membership.findUniqueOrThrow({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
  });
  res.json(prefsFrom(m.notifyPrefs));
});

notificationsRouter.patch("/settings", async (req, res) => {
  const { user, workspace } = wsCtx(req);
  const changes = parse(notificationPrefsSchema, req.body);
  const where = { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } };
  const m = await prisma.membership.findUniqueOrThrow({ where });
  const next = { ...prefsFrom(m.notifyPrefs), ...changes };
  await prisma.membership.update({ where, data: { notifyPrefs: JSON.stringify(next) } });
  res.json(next);
});

notificationsRouter.post("/:notificationId/read", async (req, res) => {
  const { user, workspace } = wsCtx(req);
  const { count } = await prisma.notification.updateMany({
    where: { id: String(req.params.notificationId), userId: user.id, workspaceId: workspace.id },
    data: { readAt: new Date() },
  });
  if (!count) throw notFound("Notification");
  res.status(204).end();
});

notificationsRouter.post("/:notificationId/unread", async (req, res) => {
  const { user, workspace } = wsCtx(req);
  const { count } = await prisma.notification.updateMany({
    where: { id: String(req.params.notificationId), userId: user.id, workspaceId: workspace.id },
    data: { readAt: null },
  });
  if (!count) throw notFound("Notification");
  res.status(204).end();
});
