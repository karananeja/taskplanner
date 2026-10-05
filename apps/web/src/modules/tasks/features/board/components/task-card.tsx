import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { errorMessage, groupByStatus } from "@tp/data-stores";
import { CLOSED_STATUSES, STATUS_LABELS, TASK_STATUSES, type Client, type Label, type Member, type TaskCard as Task, type TaskStatus } from "@tp/shared";
import { CornerDownRight, ListChecks, MessageSquare, Network } from "lucide-react";
import { memo } from "react";
import { toast } from "sonner";
import { taskStore } from "@/hooks/use-tasks";
import { useWorkspaceId } from "@/hooks/use-workspace";
import { AvatarStack } from "@/components/ui/avatar";
import { DotBadge, TintBadge } from "@/components/ui/badge";
import { formatDay, formatRange, formatShortCreated, todayISO } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { priorityMeta } from "../../../lib/meta";

export interface CardLookups {
  members: Map<string, Member>;
  labels: Map<string, Label>;
  clients: Map<string, Client>;
}

/** Presentational card; also used for the drag overlay. */
export const TaskCardView = memo(function TaskCardView({
  task,
  lookups,
  className,
}: {
  task: Task;
  lookups: CardLookups;
  className?: string;
}) {
  const p = priorityMeta(task.priority);
  const range = formatRange(task.startDate, task.endDate);
  const overdue = task.dueDate !== null && task.dueDate < todayISO() && !CLOSED_STATUSES.includes(task.status);
  const assignees = task.assigneeIds.map((id) => lookups.members.get(id)).filter((m): m is Member => Boolean(m));
  const client = task.clientId ? lookups.clients.get(task.clientId) : undefined;
  const labels = task.labelIds.map((id) => lookups.labels.get(id)).filter((l): l is Label => Boolean(l));

  return (
    <div className={cn("rounded-lg border bg-card p-3 text-left text-card-foreground", className)}>
      {task.parent && (
        <p className="mb-1 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
          <CornerDownRight className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{task.parent.title}</span>
        </p>
      )}
      <p className="text-sm leading-snug font-medium break-words">{task.title}</p>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        <DotBadge color={p.color}>{p.label}</DotBadge>
        {range && <span>{range}</span>}
        {task.checklistTotal > 0 && (
          <span className="inline-flex items-center gap-1" title="Checklist">
            <ListChecks className="size-3" aria-hidden />
            {task.checklistDone}/{task.checklistTotal}
          </span>
        )}
      </div>

      {(labels.length > 0 || client) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {client && <DotBadge color={client.color}>{client.name}</DotBadge>}
          {labels.map((l) => (
            <TintBadge key={l.id} color={l.color}>
              {l.name}
            </TintBadge>
          ))}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        {task.dueDate && (
          <span className={cn(overdue && "font-medium text-destructive")}>
            {overdue ? "Overdue · " : "Due "}
            {formatDay(task.dueDate)}
          </span>
        )}
        {task.subtaskCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <Network className="size-3" aria-hidden />
            {task.subtaskCount} {task.subtaskCount === 1 ? "subtask" : "subtasks"}
          </span>
        )}
        {task.commentCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="size-3" aria-hidden />
            {task.commentCount}
          </span>
        )}
        <span>
          by {task.createdBy.name}, {formatShortCreated(task.createdAt)}
        </span>
      </div>

      <div className="mt-2.5">
        {assignees.length > 0 ? (
          <AvatarStack users={assignees} />
        ) : (
          <span
            className="inline-flex size-6 items-center justify-center rounded-full border border-dashed text-[10px] text-muted-foreground"
            title="Unassigned"
          >
            ?
          </span>
        )}
      </div>
    </div>
  );
});

export function SortableTaskCard({
  task,
  lookups,
  onOpen,
}: {
  task: Task;
  lookups: CardLookups;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", status: task.status },
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("group/card relative list-none", isDragging && "opacity-40")}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={() => onOpen(task.id)}
        aria-label={`${task.title}. Press space to pick up and move.`}
        className="block w-full cursor-grab rounded-lg transition-colors hover:[&>div]:border-input active:cursor-grabbing"
      >
        <TaskCardView task={task} lookups={lookups} />
      </button>
      {!isDragging && <QuickStatus task={task} />}
    </li>
  );
}

/** Status menu that appears on hover, so a card can move without dragging or opening the panel. */
function QuickStatus({ task }: { task: Task }) {
  const wid = useWorkspaceId();
  const move = (status: TaskStatus) => {
    if (status === task.status) return;
    // Drop at the bottom of the target column.
    const board = taskStore().board(wid).getSnapshot().data ?? [];
    const target = groupByStatus(board, TASK_STATUSES)[status];
    const beforeId = target.at(-1)?.id ?? null;
    taskStore()
      .move(wid, task.id, { status, beforeId, afterId: null })
      .then((res) => {
        if (res.result === "requested") {
          toast.info("Change request sent", {
            description: `You're not an owner or assignee, so moving it to ${STATUS_LABELS[status]} needs an owner's approval.`,
          });
        }
      })
      .catch((e) => toast.error(errorMessage(e)));
  };
  return (
    <select
      value={task.status}
      onChange={(e) => move(e.target.value as TaskStatus)}
      aria-label={`Status of ${task.title}`}
      title="Change status"
      className="absolute right-2.5 bottom-2.5 h-6 max-w-32 rounded border border-input bg-popover px-1 text-[11px] opacity-0 transition-opacity group-hover/card:opacity-100 focus-visible:opacity-100"
    >
      {TASK_STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
