export const TASK_STATUSES = ["BACKLOG", "TODO", "IN_PROGRESS", "TESTING", "DONE", "CANCELED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  BACKLOG: "Backlog",
  TODO: "To do",
  IN_PROGRESS: "In progress",
  TESTING: "Testing & Validation",
  DONE: "Done",
  CANCELED: "Canceled",
};

/** Statuses that count as finished: no overdue warnings, not "open". */
export const CLOSED_STATUSES: readonly TaskStatus[] = ["DONE", "CANCELED"];

export const TASK_PRIORITIES = ["NONE", "LOW", "MEDIUM", "HIGH"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  NONE: "No priority",
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export const WORKSPACE_ROLES = ["OWNER", "MEMBER"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const NOTIFICATION_TYPES = ["ASSIGNED", "MENTIONED", "CHANGE_REQUESTED", "CHANGE_APPROVED", "CHANGE_REJECTED"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_LABELS: Record<NotificationType, { label: string; description: string }> = {
  ASSIGNED: { label: "Assignments", description: "Someone assigns you to a task" },
  MENTIONED: { label: "Mentions", description: "Someone @mentions you in a comment" },
  CHANGE_REQUESTED: { label: "Change requests", description: "Someone asks to change a task you own" },
  CHANGE_APPROVED: { label: "Approvals", description: "An owner approves your change request" },
  CHANGE_REJECTED: { label: "Rejections", description: "An owner rejects your change request" },
};

export const SWATCHES = [
  "#3b82f6", "#16a34a", "#d97706", "#dc2626", "#9333ea",
  "#0891b2", "#db2777", "#65a30d", "#ea580c", "#4f46e5",
] as const;

export const LIMITS = {
  title: 300,
  description: 20_000,
  comment: 10_000,
  name: 80,
  checklistText: 300,
  docBody: 200_000,
  /** Largest file you can upload to Docs, in bytes. */
  uploadBytes: 5 * 1024 * 1024,
} as const;
