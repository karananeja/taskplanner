import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  type Client,
  type Label,
  type Member,
  type TaskFieldKey,
  type TaskPriority,
  type TaskStatus,
} from "@tp/shared";
import { formatDate } from "@/lib/dates";

export const FIELD_LABELS: Record<TaskFieldKey, string> = {
  title: "Title",
  description: "Description",
  status: "Status",
  priority: "Priority",
  clientId: "Client",
  startDate: "Start date",
  endDate: "End date",
  dueDate: "Due date",
  assigneeIds: "Assignees",
  ownerIds: "Owners",
  labelIds: "Labels",
};

export interface FieldLookups {
  members: Map<string, Member>;
  labels: Map<string, Label>;
  clients: Map<string, Client>;
}

/** Human-readable value for history entries and change-request diffs. */
export function formatFieldValue(field: TaskFieldKey, value: unknown, l: FieldLookups): string {
  if (value === null || value === undefined || value === "") {
    return { clientId: "No client", startDate: "None", endDate: "None", dueDate: "None", description: "Empty" }[field as string] ?? "None";
  }
  switch (field) {
    case "status":
      return STATUS_LABELS[value as TaskStatus] ?? String(value);
    case "priority":
      return PRIORITY_LABELS[value as TaskPriority] ?? String(value);
    case "clientId":
      return l.clients.get(value as string)?.name ?? "Removed client";
    case "startDate":
    case "endDate":
    case "dueDate":
      return formatDate(value as string);
    case "assigneeIds":
    case "ownerIds": {
      const ids = value as string[];
      return ids.length ? ids.map((id) => l.members.get(id)?.name ?? "Former member").join(", ") : "Nobody";
    }
    case "labelIds": {
      const ids = value as string[];
      return ids.length ? ids.map((id) => l.labels.get(id)?.name ?? "Removed label").join(", ") : "None";
    }
    case "description": {
      const s = String(value);
      return s.length > 80 ? `${s.slice(0, 80)}…` : s;
    }
    default:
      return String(value);
  }
}
