import {
  type Activity,
  type ActivityData,
  type Comment as CommentDto,
  type TaskStatus,
  type UpdateTaskResult,
  checklistCreateSchema,
  checklistUpdateSchema,
  commentCreateSchema,
  createTaskSchema,
  moveTaskSchema,
  reviewChangeRequestSchema,
  updateTaskSchema,
} from "@tp/shared";
import { type Request, Router } from "express";
import { prisma } from "../db";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { parseJson } from "../lib/json";
import { parse } from "../lib/validate";
import { wsCtx } from "../middleware/auth";
import { logActivity } from "../services/activity";
import { notify } from "../services/notify";
import { cardInclude, toCard, userSummary } from "../services/serialize";
import {
  type Actor,
  applyChanges,
  createChangeRequest,
  currentFields,
  diffFields,
  endOfColumn,
  getTaskDetail,
  loadDetail,
  permissionsFor,
  positionFromNeighbours,
  validateReferences,
} from "../services/tasks";

export const tasksRouter = Router({ mergeParams: true });

function actorOf(req: Request): Actor & { workspaceId: string } {
  const { user, workspace } = wsCtx(req);
  return { userId: user.id, role: workspace.role, workspaceId: workspace.id };
}
const taskIdOf = (req: Request) => String(req.params.taskId);

/** Board: every task in the workspace, including subtasks. Filtering happens client-side. */
tasksRouter.get("/", async (req, res) => {
  const { workspaceId } = actorOf(req);
  const tasks = await prisma.task.findMany({
    where: { workspaceId },
    include: cardInclude,
    orderBy: { position: "asc" },
  });
  res.json(tasks.map(toCard));
});

tasksRouter.post("/", async (req, res) => {
  const actor = actorOf(req);
  const input = parse(createTaskSchema, req.body);
  const status: TaskStatus = input.status ?? "TODO";

  const id = await prisma.$transaction(async (tx) => {
    let parentTitle: string | null = null;
    if (input.parentId) {
      const parent = await tx.task.findFirst({ where: { id: input.parentId, workspaceId: actor.workspaceId } });
      if (!parent) throw notFound("Parent task");
      if (parent.parentId) throw badRequest("Subtasks can't have their own subtasks.");
      parentTitle = parent.title;
    }
    // The creator is always an owner.
    const ownerIds = [...new Set([actor.userId, ...(input.ownerIds ?? [])])];
    const assigneeIds = [...new Set(input.assigneeIds ?? [])];
    const labelIds = [...new Set(input.labelIds ?? [])];
    await validateReferences(tx, actor.workspaceId, { ownerIds, assigneeIds, labelIds, clientId: input.clientId ?? null });

    const task = await tx.task.create({
      data: {
        workspaceId: actor.workspaceId,
        title: input.title,
        description: input.description ?? "",
        status,
        priority: input.priority ?? "NONE",
        clientId: input.clientId ?? null,
        parentId: input.parentId ?? null,
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        dueDate: input.dueDate ?? null,
        position: await endOfColumn(tx, actor.workspaceId, status),
        createdById: actor.userId,
        owners: { create: ownerIds.map((userId) => ({ userId })) },
        assignees: { create: assigneeIds.map((userId) => ({ userId })) },
        labels: { create: labelIds.map((labelId) => ({ labelId })) },
      },
    });
    await logActivity(tx, task.id, actor.userId, { type: "created" });
    if (input.parentId && parentTitle !== null) {
      await logActivity(tx, input.parentId, actor.userId, { type: "subtask_added", subtaskId: task.id, title: task.title });
    }
    await notify(tx, {
      userIds: assigneeIds,
      type: "ASSIGNED",
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      taskId: task.id,
      data: { title: task.title },
    });
    return task.id;
  });

  res.status(201).json(await getTaskDetail(prisma, actor.workspaceId, id, actor));
});

tasksRouter.get("/:taskId", async (req, res) => {
  const actor = actorOf(req);
  res.json(await getTaskDetail(prisma, actor.workspaceId, taskIdOf(req), actor));
});

/**
 * Edit a task. Owners apply changes directly. Assignees can change status directly.
 * Everything else a non-owner edits becomes a change request for the owners to review.
 */
tasksRouter.patch("/:taskId", async (req, res) => {
  const actor = actorOf(req);
  const { baseVersion, changes } = parse(updateTaskSchema, req.body);

  const body = await prisma.$transaction(async (tx): Promise<UpdateTaskResult> => {
    const task = await loadDetail(tx, actor.workspaceId, taskIdOf(req));
    const perms = permissionsFor(task, actor);
    const diff = diffFields(currentFields(task), changes);
    if (diff.length === 0) {
      return { result: "applied", task: await getTaskDetail(tx, actor.workspaceId, task.id, actor) };
    }

    const direct = perms.isOwner ? diff : diff.filter((d) => d.field === "status" && perms.canWorkOn);
    const requested = perms.isOwner ? [] : diff.filter((d) => !direct.includes(d));

    if (direct.length && task.version !== baseVersion) {
      throw conflict(
        "Someone else saved this task while you were editing. Review the latest version, then save again.",
        { currentVersion: task.version },
      );
    }
    await applyChanges(tx, task, direct, actor.userId);
    const changeRequest = requested.length ? await createChangeRequest(tx, task, requested, actor.userId) : null;
    const detail = await getTaskDetail(tx, actor.workspaceId, task.id, actor);

    if (!changeRequest) return { result: "applied", task: detail };
    return { result: direct.length ? "partial" : "requested", task: detail, changeRequest };
  });

  res.json(body);
});

/** Drag and drop. Reordering within a column is open to everyone; changing column follows edit rules. */
tasksRouter.post("/:taskId/move", async (req, res) => {
  const actor = actorOf(req);
  const input = parse(moveTaskSchema, req.body);

  const body = await prisma.$transaction(async (tx) => {
    const task = await loadDetail(tx, actor.workspaceId, taskIdOf(req));
    const perms = permissionsFor(task, actor);
    const changingStatus = task.status !== input.status;

    if (changingStatus && !perms.canWorkOn) {
      const diff = diffFields(currentFields(task), { status: input.status });
      const changeRequest = await createChangeRequest(tx, task, diff, actor.userId);
      return { result: "requested" as const, changeRequest, task: toCard(task) };
    }

    const position = await positionFromNeighbours(tx, actor.workspaceId, input.status, input.beforeId, input.afterId);
    await tx.task.update({
      where: { id: task.id },
      data: changingStatus ? { status: input.status, position, version: { increment: 1 } } : { position },
    });
    if (changingStatus) {
      await logActivity(tx, task.id, actor.userId, {
        type: "moved",
        from: task.status as TaskStatus,
        to: input.status,
      });
    }
    const updated = await tx.task.findUniqueOrThrow({ where: { id: task.id }, include: cardInclude });
    return { result: "applied" as const, task: toCard(updated) };
  });

  res.json(body);
});

tasksRouter.delete("/:taskId", async (req, res) => {
  const actor = actorOf(req);
  const task = await loadDetail(prisma, actor.workspaceId, taskIdOf(req));
  if (!permissionsFor(task, actor).canDelete) throw forbidden("Only this task's owners can delete it.");
  await prisma.task.delete({ where: { id: task.id } });
  res.status(204).end();
});

// Change requests

tasksRouter.post("/:taskId/change-requests/:requestId/approve", async (req, res) => {
  const actor = actorOf(req);
  const note = parse(reviewChangeRequestSchema, req.body ?? {}).note;
  const detail = await prisma.$transaction(async (tx) => {
    const task = await loadDetail(tx, actor.workspaceId, taskIdOf(req));
    if (!permissionsFor(task, actor).isOwner) throw forbidden("Only this task's owners can approve changes.");
    const cr = await tx.changeRequest.findFirst({ where: { id: String(req.params.requestId), taskId: task.id } });
    if (!cr) throw notFound("Change request");
    if (cr.status !== "PENDING") throw conflict("This request has already been reviewed.");

    const diff = diffFields(currentFields(task), parseJson(cr.changes, {}));
    await applyChanges(tx, task, diff, actor.userId, cr.id);
    await tx.changeRequest.update({
      where: { id: cr.id },
      data: { status: "APPROVED", reviewerId: actor.userId, reviewNote: note ?? null, reviewedAt: new Date() },
    });
    await logActivity(tx, task.id, actor.userId, { type: "change_approved", requestId: cr.id, requesterId: cr.requesterId });
    await notify(tx, {
      userIds: [cr.requesterId],
      type: "CHANGE_APPROVED",
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      taskId: task.id,
      data: { requestId: cr.id, title: task.title },
    });
    return getTaskDetail(tx, actor.workspaceId, task.id, actor);
  });
  res.json(detail);
});

tasksRouter.post("/:taskId/change-requests/:requestId/reject", async (req, res) => {
  const actor = actorOf(req);
  const note = parse(reviewChangeRequestSchema, req.body ?? {}).note;
  const detail = await prisma.$transaction(async (tx) => {
    const task = await loadDetail(tx, actor.workspaceId, taskIdOf(req));
    if (!permissionsFor(task, actor).isOwner) throw forbidden("Only this task's owners can reject changes.");
    const cr = await tx.changeRequest.findFirst({ where: { id: String(req.params.requestId), taskId: task.id } });
    if (!cr) throw notFound("Change request");
    if (cr.status !== "PENDING") throw conflict("This request has already been reviewed.");
    await tx.changeRequest.update({
      where: { id: cr.id },
      data: { status: "REJECTED", reviewerId: actor.userId, reviewNote: note ?? null, reviewedAt: new Date() },
    });
    await logActivity(tx, task.id, actor.userId, {
      type: "change_rejected",
      requestId: cr.id,
      requesterId: cr.requesterId,
      note,
    });
    await notify(tx, {
      userIds: [cr.requesterId],
      type: "CHANGE_REJECTED",
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      taskId: task.id,
      data: { requestId: cr.id, title: task.title, note },
    });
    return getTaskDetail(tx, actor.workspaceId, task.id, actor);
  });
  res.json(detail);
});

/** The requester can withdraw their own pending request. */
tasksRouter.delete("/:taskId/change-requests/:requestId", async (req, res) => {
  const actor = actorOf(req);
  const task = await loadDetail(prisma, actor.workspaceId, taskIdOf(req));
  const { count } = await prisma.changeRequest.deleteMany({
    where: { id: String(req.params.requestId), taskId: task.id, requesterId: actor.userId, status: "PENDING" },
  });
  if (!count) throw notFound("Change request");
  res.json(await getTaskDetail(prisma, actor.workspaceId, task.id, actor));
});

// Checklist — owners and assignees

async function checklistGuard(req: Request) {
  const actor = actorOf(req);
  const task = await loadDetail(prisma, actor.workspaceId, taskIdOf(req));
  if (!permissionsFor(task, actor).canWorkOn) {
    throw forbidden("Only owners and assignees can change the checklist.");
  }
  return { actor, task };
}

tasksRouter.post("/:taskId/checklist", async (req, res) => {
  const { actor, task } = await checklistGuard(req);
  const { text } = parse(checklistCreateSchema, req.body);
  await prisma.$transaction(async (tx) => {
    const last = await tx.checklistItem.findFirst({ where: { taskId: task.id }, orderBy: { position: "desc" } });
    await tx.checklistItem.create({ data: { taskId: task.id, text, position: (last?.position ?? 0) + 1 } });
    await logActivity(tx, task.id, actor.userId, { type: "checklist_added", text });
  });
  res.status(201).json(await getTaskDetail(prisma, actor.workspaceId, task.id, actor));
});

tasksRouter.patch("/:taskId/checklist/:itemId", async (req, res) => {
  const { actor, task } = await checklistGuard(req);
  const input = parse(checklistUpdateSchema, req.body);
  const item = task.checklist.find((c) => c.id === req.params.itemId);
  if (!item) throw notFound("Checklist item");
  await prisma.$transaction(async (tx) => {
    await tx.checklistItem.update({ where: { id: item.id }, data: input });
    if (input.done !== undefined && input.done !== item.done) {
      await logActivity(tx, task.id, actor.userId, { type: "checklist_checked", text: input.text ?? item.text, done: input.done });
    }
  });
  res.json(await getTaskDetail(prisma, actor.workspaceId, task.id, actor));
});

tasksRouter.delete("/:taskId/checklist/:itemId", async (req, res) => {
  const { actor, task } = await checklistGuard(req);
  const item = task.checklist.find((c) => c.id === req.params.itemId);
  if (!item) throw notFound("Checklist item");
  await prisma.$transaction(async (tx) => {
    await tx.checklistItem.delete({ where: { id: item.id } });
    await logActivity(tx, task.id, actor.userId, { type: "checklist_removed", text: item.text });
  });
  res.json(await getTaskDetail(prisma, actor.workspaceId, task.id, actor));
});

// Comments — any member

tasksRouter.get("/:taskId/comments", async (req, res) => {
  const actor = actorOf(req);
  const task = await loadDetail(prisma, actor.workspaceId, taskIdOf(req));
  const comments = await prisma.comment.findMany({
    where: { taskId: task.id },
    include: { author: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(
    comments.map(
      (c): CommentDto => ({
        id: c.id,
        body: c.body,
        author: userSummary(c.author),
        mentionIds: parseJson<string[]>(c.mentionIds, []),
        createdAt: c.createdAt.toISOString(),
      }),
    ),
  );
});

tasksRouter.post("/:taskId/comments", async (req, res) => {
  const actor = actorOf(req);
  const input = parse(commentCreateSchema, req.body);
  const comment = await prisma.$transaction(async (tx) => {
    const task = await loadDetail(tx, actor.workspaceId, taskIdOf(req));
    // Only keep mentions of real members whose @Name is still in the text.
    const candidates = await tx.membership.findMany({
      where: { workspaceId: actor.workspaceId, userId: { in: input.mentionIds } },
      include: { user: true },
    });
    const mentionIds = candidates.filter((m) => input.body.includes(`@${m.user.name}`)).map((m) => m.userId);
    const c = await tx.comment.create({
      data: { taskId: task.id, authorId: actor.userId, body: input.body, mentionIds: JSON.stringify(mentionIds) },
      include: { author: true },
    });
    await logActivity(tx, task.id, actor.userId, { type: "commented", commentId: c.id });
    await notify(tx, {
      userIds: mentionIds,
      type: "MENTIONED",
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      taskId: task.id,
      data: { commentId: c.id, title: task.title, excerpt: input.body.slice(0, 140) },
    });
    return { ...c, mentionIds };
  });
  const body: CommentDto = {
    id: comment.id,
    body: comment.body,
    author: userSummary(comment.author),
    mentionIds: comment.mentionIds,
    createdAt: comment.createdAt.toISOString(),
  };
  res.status(201).json(body);
});

tasksRouter.delete("/:taskId/comments/:commentId", async (req, res) => {
  const actor = actorOf(req);
  const task = await loadDetail(prisma, actor.workspaceId, taskIdOf(req));
  const comment = await prisma.comment.findFirst({ where: { id: String(req.params.commentId), taskId: task.id } });
  if (!comment) throw notFound("Comment");
  if (comment.authorId !== actor.userId && actor.role !== "OWNER") {
    throw forbidden("You can only delete your own comments.");
  }
  await prisma.comment.delete({ where: { id: comment.id } });
  res.status(204).end();
});

// History

tasksRouter.get("/:taskId/activity", async (req, res) => {
  const actor = actorOf(req);
  const task = await loadDetail(prisma, actor.workspaceId, taskIdOf(req));
  const rows = await prisma.activity.findMany({
    where: { taskId: task.id },
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json(
    rows.map(
      (a): Activity =>
        ({
          ...parseJson<object>(a.data, {}),
          type: a.type,
          id: a.id,
          actor: userSummary(a.actor),
          createdAt: a.createdAt.toISOString(),
        }) as Activity & ActivityData,
    ),
  );
});
