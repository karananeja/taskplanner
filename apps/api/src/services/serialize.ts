import type {
  ChangeRequest as ChangeRequestDto,
  TaskCard,
  TaskDetail,
  TaskFields,
  TaskPermissions,
  TaskPriority,
  TaskStatus,
  UserSummary,
} from "@tp/shared";
import type { Prisma, User } from "../generated/prisma/client";
import { parseJson } from "../lib/json";

export const userSummary = (u: Pick<User, "id" | "name" | "email" | "avatarUrl">): UserSummary => ({
  id: u.id,
  name: u.name,
  email: u.email,
  avatarUrl: u.avatarUrl,
});

export const cardInclude = {
  createdBy: true,
  parent: { select: { id: true, title: true } },
  assignees: { select: { userId: true } },
  owners: { select: { userId: true } },
  labels: { select: { labelId: true } },
  checklist: { select: { done: true } },
  _count: { select: { subtasks: true, comments: true } },
} satisfies Prisma.TaskInclude;

export const detailInclude = {
  ...cardInclude,
  checklist: { orderBy: { position: "asc" } },
  subtasks: { select: { id: true, title: true, status: true, priority: true }, orderBy: { createdAt: "asc" } },
  changeRequests: {
    where: { status: "PENDING" },
    include: { requester: true, reviewer: true },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.TaskInclude;

export type CardTask = Prisma.TaskGetPayload<{ include: typeof cardInclude }>;
export type DetailTask = Prisma.TaskGetPayload<{ include: typeof detailInclude }>;

export function toCard(t: CardTask): TaskCard {
  return {
    id: t.id,
    title: t.title,
    status: t.status as TaskStatus,
    priority: t.priority as TaskPriority,
    position: t.position,
    clientId: t.clientId,
    startDate: t.startDate,
    endDate: t.endDate,
    dueDate: t.dueDate,
    parent: t.parent,
    createdBy: userSummary(t.createdBy),
    createdAt: t.createdAt.toISOString(),
    assigneeIds: t.assignees.map((a) => a.userId),
    ownerIds: t.owners.map((o) => o.userId),
    labelIds: t.labels.map((l) => l.labelId),
    subtaskCount: t._count.subtasks,
    commentCount: t._count.comments,
    checklistDone: t.checklist.filter((c) => c.done).length,
    checklistTotal: t.checklist.length,
    version: t.version,
  };
}

type CrRow = Prisma.ChangeRequestGetPayload<{ include: { requester: true; reviewer: true } }>;

export function toChangeRequest(cr: CrRow): ChangeRequestDto {
  return {
    id: cr.id,
    status: cr.status as ChangeRequestDto["status"],
    requester: userSummary(cr.requester),
    changes: parseJson<Partial<TaskFields>>(cr.changes, {}),
    previous: parseJson<Partial<TaskFields>>(cr.previous, {}),
    reviewer: cr.reviewer ? userSummary(cr.reviewer) : null,
    reviewNote: cr.reviewNote,
    createdAt: cr.createdAt.toISOString(),
    reviewedAt: cr.reviewedAt?.toISOString() ?? null,
  };
}

export function toDetail(t: DetailTask, permissions: TaskPermissions): TaskDetail {
  return {
    ...toCard(t),
    description: t.description,
    checklist: t.checklist.map((c) => ({ id: c.id, text: c.text, done: c.done })),
    subtasks: t.subtasks.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status as TaskStatus,
      priority: s.priority as TaskPriority,
    })),
    pendingChangeRequests: t.changeRequests.map(toChangeRequest),
    permissions,
    updatedAt: t.updatedAt.toISOString(),
  };
}
