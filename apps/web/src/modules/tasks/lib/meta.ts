import { PRIORITY_LABELS, type TaskPriority } from "@tp/shared";

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  NONE: "#71717a",
  LOW: "#3b82f6",
  MEDIUM: "#eab308",
  HIGH: "#f97316",
};

export const priorityMeta = (p: TaskPriority) => ({ label: PRIORITY_LABELS[p], color: PRIORITY_COLORS[p] });
