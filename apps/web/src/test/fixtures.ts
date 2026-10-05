import type { Label, Me, Member, TaskCard, TaskDetail, WorkspaceDetail } from "@tp/shared";

/** Builders for API payloads. Override only what a test cares about. */

export const WID = "ws_1";

export const people = {
  karan: { id: "u_karan", name: "Karan Aneja", email: "karan@example.com", avatarUrl: null },
  jay: { id: "u_jay", name: "Jay Shrivastava", email: "jay@example.com", avatarUrl: null },
  chirag: { id: "u_chirag", name: "Chirag Kumar", email: "chirag@example.com", avatarUrl: null },
};

export const member = (u: (typeof people)[keyof typeof people], role: Member["role"] = "MEMBER"): Member => ({
  ...u,
  role,
  joinedAt: "2026-09-01T00:00:00.000Z",
});

export const makeMe = (overrides: Partial<Me> = {}): Me => ({
  user: people.karan,
  workspaces: [{ id: WID, name: "Software", role: "OWNER" }],
  ...overrides,
});

export const makeWorkspace = (overrides: Partial<WorkspaceDetail> = {}): WorkspaceDetail => ({
  id: WID,
  name: "Software",
  inviteCode: "testinvite123",
  myRole: "OWNER",
  members: [member(people.karan, "OWNER"), member(people.jay), member(people.chirag)],
  ...overrides,
});

export const labels: Label[] = [
  { id: "l_bug", name: "Bug", color: "#dc2626" },
  { id: "l_feat", name: "Feature", color: "#4f46e5" },
];

let seq = 0;
export function makeTask(overrides: Partial<TaskDetail> = {}): TaskDetail {
  seq += 1;
  return {
    id: `t_${seq}`,
    title: `Task ${seq}`,
    status: "TODO",
    priority: "NONE",
    position: `a${seq}`,
    clientId: null,
    startDate: null,
    endDate: null,
    dueDate: null,
    parent: null,
    createdBy: people.karan,
    createdAt: "2026-09-30T08:00:00.000Z",
    assigneeIds: [],
    ownerIds: [people.karan.id],
    labelIds: [],
    subtaskCount: 0,
    commentCount: 0,
    checklistDone: 0,
    checklistTotal: 0,
    version: 1,
    description: "",
    checklist: [],
    subtasks: [],
    pendingChangeRequests: [],
    permissions: { isOwner: true, isAssignee: false, canDelete: true, canWorkOn: true },
    updatedAt: "2026-09-30T08:00:00.000Z",
    ...overrides,
  };
}

export function toCard(t: TaskDetail): TaskCard {
  const { description, checklist, subtasks, pendingChangeRequests, permissions, updatedAt, ...card } = t;
  void description, checklist, subtasks, pendingChangeRequests, permissions, updatedAt;
  return card;
}

/** Permissions as seen by a member who neither owns nor is assigned to the task. */
export const asOutsider = { isOwner: false, isAssignee: false, canDelete: false, canWorkOn: false };
