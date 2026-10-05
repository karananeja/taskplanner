import type { NotificationType, TaskPriority, TaskStatus, WorkspaceRole } from "./constants";
import type { TaskFieldKey, TaskFields } from "./schemas";

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: WorkspaceRole;
}

export interface Me {
  user: UserSummary;
  workspaces: WorkspaceSummary[];
}

export interface AuthConfig {
  google: boolean;
}

export interface Member extends UserSummary {
  role: WorkspaceRole;
  joinedAt: string;
}

export interface WorkspaceDetail {
  id: string;
  name: string;
  inviteCode: string;
  myRole: WorkspaceRole;
  members: Member[];
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  color: string;
  taskCount: number;
  docCount: number;
}

/** A task as shown on the board. */
export interface TaskCard {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  position: string;
  clientId: string | null;
  startDate: string | null;
  endDate: string | null;
  dueDate: string | null;
  parent: { id: string; title: string } | null;
  createdBy: UserSummary;
  createdAt: string;
  assigneeIds: string[];
  ownerIds: string[];
  labelIds: string[];
  subtaskCount: number;
  commentCount: number;
  checklistDone: number;
  checklistTotal: number;
  version: number;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export type ChangeRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface ChangeRequest {
  id: string;
  status: ChangeRequestStatus;
  requester: UserSummary;
  changes: Partial<TaskFields>;
  /** Values at the time the request was made, for showing a before → after diff. */
  previous: Partial<TaskFields>;
  reviewer: UserSummary | null;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface TaskPermissions {
  isOwner: boolean;
  isAssignee: boolean;
  canDelete: boolean;
  /** Can change status and tick the checklist without approval. */
  canWorkOn: boolean;
}

export interface TaskDetail extends TaskCard {
  description: string;
  checklist: ChecklistItem[];
  subtasks: Pick<TaskCard, "id" | "title" | "status" | "priority">[];
  pendingChangeRequests: ChangeRequest[];
  permissions: TaskPermissions;
  updatedAt: string;
}

export interface Comment {
  id: string;
  body: string;
  author: UserSummary;
  mentionIds: string[];
  createdAt: string;
}

export interface FieldChange {
  field: TaskFieldKey;
  from: unknown;
  to: unknown;
}

export type ActivityData =
  | { type: "created" }
  | { type: "updated"; changes: FieldChange[]; viaRequestId?: string }
  | { type: "moved"; from: TaskStatus; to: TaskStatus }
  | { type: "change_requested"; requestId: string; fields: TaskFieldKey[] }
  | { type: "change_approved"; requestId: string; requesterId: string }
  | { type: "change_rejected"; requestId: string; requesterId: string; note?: string }
  | { type: "commented"; commentId: string }
  | { type: "subtask_added"; subtaskId: string; title: string }
  | { type: "checklist_added"; text: string }
  | { type: "checklist_checked"; text: string; done: boolean }
  | { type: "checklist_removed"; text: string };

export type Activity = ActivityData & {
  id: string;
  actor: UserSummary;
  createdAt: string;
};

export type UpdateTaskResult =
  | { result: "applied"; task: TaskDetail }
  | { result: "requested"; task: TaskDetail; changeRequest: ChangeRequest }
  | { result: "partial"; task: TaskDetail; changeRequest: ChangeRequest };

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

export interface Notification {
  id: string;
  type: NotificationType;
  task: { id: string; title: string } | null;
  actor: UserSummary | null;
  data: { title?: string; excerpt?: string; note?: string; [key: string]: unknown };
  readAt: string | null;
  createdAt: string;
}

/** `false` mutes that notification type; missing means on. */
export type NotificationPrefs = Record<NotificationType, boolean>;

/** A pending change request on a task you own, for the Home dashboard. */
export interface ReviewItem {
  id: string;
  task: { id: string; title: string };
  requester: UserSummary;
  fields: TaskFieldKey[];
  createdAt: string;
}

export interface DocSummary {
  id: string;
  title: string;
  clientId: string | null;
  /** "file" for an upload, "doc" for one written in the app. */
  kind: "doc" | "file";
  fileName: string | null;
  fileType: string | null;
  fileSize: number | null;
  createdBy: UserSummary;
  createdAt: string;
  updatedAt: string;
}

export interface DocDetail extends DocSummary {
  body: string;
}
