import {
  type FieldChange,
  type TaskChanges,
  type TaskFieldKey,
  type TaskFields,
  type TaskPermissions,
  type TaskStatus,
  type WorkspaceRole,
  positionBetween,
} from "@tp/shared";
import { prisma, type Tx } from "../db";
import { badRequest, notFound } from "../lib/errors";
import { logActivity } from "./activity";
import { notify } from "./notify";
import { type DetailTask, detailInclude, toChangeRequest, toDetail } from "./serialize";

const ARRAY_FIELDS = ["assigneeIds", "ownerIds", "labelIds"] as const satisfies readonly TaskFieldKey[];
type ArrayField = (typeof ARRAY_FIELDS)[number];
const isArrayField = (k: TaskFieldKey): k is ArrayField => (ARRAY_FIELDS as readonly string[]).includes(k);

export interface Actor {
  userId: string;
  role: WorkspaceRole;
}

type TaskWithPeople = { owners: { userId: string }[]; assignees: { userId: string }[] };

export function permissionsFor(task: TaskWithPeople, actor: Actor): TaskPermissions {
  // The workspace owner can act as an owner on every task.
  const isOwner = actor.role === "OWNER" || task.owners.some((o) => o.userId === actor.userId);
  const isAssignee = task.assignees.some((a) => a.userId === actor.userId);
  return { isOwner, isAssignee, canDelete: isOwner, canWorkOn: isOwner || isAssignee };
}

export async function loadDetail(db: Tx | typeof prisma, workspaceId: string, taskId: string) {
  const task = await db.task.findFirst({ where: { id: taskId, workspaceId }, include: detailInclude });
  if (!task) throw notFound("Task");
  return task;
}

export async function getTaskDetail(db: Tx | typeof prisma, workspaceId: string, taskId: string, actor: Actor) {
  const task = await loadDetail(db, workspaceId, taskId);
  return toDetail(task, permissionsFor(task, actor));
}

export function currentFields(t: DetailTask): TaskFields {
  return {
    title: t.title,
    description: t.description,
    status: t.status as TaskStatus,
    priority: t.priority as TaskFields["priority"],
    clientId: t.clientId,
    startDate: t.startDate,
    endDate: t.endDate,
    dueDate: t.dueDate,
    assigneeIds: t.assignees.map((a) => a.userId),
    ownerIds: t.owners.map((o) => o.userId),
    labelIds: t.labels.map((l) => l.labelId),
  };
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Only the fields whose value actually differs from the current task. */
export function diffFields(current: TaskFields, changes: TaskChanges): FieldChange[] {
  const out: FieldChange[] = [];
  for (const key of Object.keys(changes) as TaskFieldKey[]) {
    const to = changes[key];
    if (to === undefined) continue;
    const from = current[key];
    const unchanged = isArrayField(key) ? sameSet(from as string[], to as string[]) : from === to;
    if (!unchanged) out.push({ field: key, from, to });
  }
  return out;
}

/** Make sure every referenced person, label and client belongs to this workspace. */
export async function validateReferences(tx: Tx, workspaceId: string, changes: Partial<TaskFields>) {
  const people = [...new Set([...(changes.assigneeIds ?? []), ...(changes.ownerIds ?? [])])];
  if (people.length) {
    const count = await tx.membership.count({ where: { workspaceId, userId: { in: people } } });
    if (count !== people.length) throw badRequest("Assignees and owners must be members of this workspace.");
  }
  if (changes.labelIds?.length) {
    const unique = [...new Set(changes.labelIds)];
    const count = await tx.label.count({ where: { workspaceId, id: { in: unique } } });
    if (count !== unique.length) throw badRequest("One of the labels no longer exists.", { labelIds: "Unknown label" });
  }
  if (changes.clientId) {
    const client = await tx.client.findFirst({ where: { workspaceId, id: changes.clientId } });
    if (!client) throw badRequest("That client no longer exists.", { clientId: "Unknown client" });
  }
}

async function topOfColumn(tx: Tx, workspaceId: string, status: TaskStatus) {
  const first = await tx.task.findFirst({ where: { workspaceId, status }, orderBy: { position: "asc" } });
  return positionBetween(null, first?.position ?? null);
}

export async function endOfColumn(tx: Tx, workspaceId: string, status: TaskStatus) {
  const last = await tx.task.findFirst({ where: { workspaceId, status }, orderBy: { position: "desc" } });
  return positionBetween(last?.position ?? null, null);
}

/**
 * Apply already-diffed changes to a task: scalar fields, relation sets, version bump,
 * history entry and assignment notifications.
 */
export async function applyChanges(
  tx: Tx,
  task: DetailTask,
  diff: FieldChange[],
  actorId: string,
  viaRequestId?: string,
) {
  if (diff.length === 0) return;
  const next = Object.fromEntries(diff.map((d) => [d.field, d.to])) as Partial<TaskFields>;
  await validateReferences(tx, task.workspaceId, next);

  const { assigneeIds, ownerIds, labelIds, ...scalars } = next;
  const data: Record<string, unknown> = { ...scalars, version: { increment: 1 } };
  if (scalars.status && scalars.status !== task.status) {
    data.position = await topOfColumn(tx, task.workspaceId, scalars.status);
  }
  await tx.task.update({ where: { id: task.id }, data });

  if (assigneeIds) {
    await tx.taskAssignee.deleteMany({ where: { taskId: task.id } });
    await tx.taskAssignee.createMany({ data: assigneeIds.map((userId) => ({ taskId: task.id, userId })) });
    const before = new Set(task.assignees.map((a) => a.userId));
    await notify(tx, {
      userIds: assigneeIds.filter((id) => !before.has(id)),
      type: "ASSIGNED",
      workspaceId: task.workspaceId,
      actorId,
      taskId: task.id,
      data: { title: next.title ?? task.title },
    });
  }
  if (ownerIds) {
    await tx.taskOwner.deleteMany({ where: { taskId: task.id } });
    await tx.taskOwner.createMany({ data: ownerIds.map((userId) => ({ taskId: task.id, userId })) });
  }
  if (labelIds) {
    await tx.taskLabel.deleteMany({ where: { taskId: task.id } });
    await tx.taskLabel.createMany({ data: labelIds.map((labelId) => ({ taskId: task.id, labelId })) });
  }

  await logActivity(tx, task.id, actorId, { type: "updated", changes: diff, viaRequestId });
}

export async function createChangeRequest(tx: Tx, task: DetailTask, diff: FieldChange[], requesterId: string) {
  const changes = Object.fromEntries(diff.map((d) => [d.field, d.to]));
  const previous = Object.fromEntries(diff.map((d) => [d.field, d.from]));
  await validateReferences(tx, task.workspaceId, changes);
  const cr = await tx.changeRequest.create({
    data: {
      taskId: task.id,
      requesterId,
      changes: JSON.stringify(changes),
      previous: JSON.stringify(previous),
      baseVersion: task.version,
    },
    include: { requester: true, reviewer: true },
  });
  await logActivity(tx, task.id, requesterId, {
    type: "change_requested",
    requestId: cr.id,
    fields: diff.map((d) => d.field),
  });
  const workspaceOwners = await tx.membership.findMany({
    where: { workspaceId: task.workspaceId, role: "OWNER" },
    select: { userId: true },
  });
  await notify(tx, {
    userIds: [...task.owners.map((o) => o.userId), ...workspaceOwners.map((m) => m.userId)],
    type: "CHANGE_REQUESTED",
    workspaceId: task.workspaceId,
    actorId: requesterId,
    taskId: task.id,
    data: { requestId: cr.id, title: task.title },
  });
  return toChangeRequest(cr);
}

/** Resolve a drop position from the neighbours the client saw. Neighbours must be in the target column. */
export async function positionFromNeighbours(
  tx: Tx,
  workspaceId: string,
  status: TaskStatus,
  beforeId: string | null,
  afterId: string | null,
) {
  const ids = [beforeId, afterId].filter((x): x is string => Boolean(x));
  const rows = ids.length
    ? await tx.task.findMany({ where: { workspaceId, status, id: { in: ids } }, select: { id: true, position: true } })
    : [];
  const before = rows.find((r) => r.id === beforeId)?.position ?? null;
  const after = rows.find((r) => r.id === afterId)?.position ?? null;
  if (before === null && after === null && ids.length) {
    // Neighbours moved elsewhere since the client loaded the board; drop at the end instead.
    return endOfColumn(tx, workspaceId, status);
  }
  return positionBetween(before, after);
}
