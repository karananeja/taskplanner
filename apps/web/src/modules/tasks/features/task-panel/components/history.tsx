import { errorMessage } from "@tp/data-stores";
import { type Activity, STATUS_LABELS } from "@tp/shared";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { useActivity } from "@/hooks/use-tasks";
import { useMemberMap } from "@/hooks/use-workspace";
import { formatDateTime, timeAgo } from "@/lib/dates";
import { useFieldLookups } from "../../../hooks/use-field-lookups";
import { FIELD_LABELS, type FieldLookups, formatFieldValue } from "../../../lib/format-field";

export function History({ wid, taskId }: { wid: string; taskId: string }) {
  const activity = useActivity(wid, taskId, true);
  const lookups = useFieldLookups(wid);
  const members = useMemberMap(wid);

  if (activity.status === "loading" || activity.status === "idle") {
    return <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Loading history" />;
  }
  if (activity.status === "error") return <p className="text-sm text-destructive">{errorMessage(activity.error)}</p>;

  // An approval writes both "approved" and the applied change; show the change once, as the approval.
  const applied = new Set(activity.data?.flatMap((a) => (a.type === "updated" && a.viaRequestId ? [a.viaRequestId] : [])));
  const rows = activity.data?.filter((a) => !(a.type === "change_approved" && applied.has(a.requestId)));

  return (
    <ol className="relative flex flex-col gap-5 border-l pl-5">
      {rows?.map((a) => (
        <li key={a.id} className="relative">
          <span className="absolute top-0.5 -left-[31px]">
            <Avatar user={a.actor} className="size-5 ring-4 ring-background" />
          </span>
          <p className="text-[13px] leading-relaxed">
            <span className="font-medium">{a.actor.name}</span> {describe(a, lookups, (id) => members.get(id)?.name ?? "someone")}
          </p>
          <time dateTime={a.createdAt} title={formatDateTime(a.createdAt)} className="text-xs text-muted-foreground">
            {timeAgo(a.createdAt)}
          </time>
        </li>
      ))}
    </ol>
  );
}

function describe(a: Activity, lookups: FieldLookups, nameOf: (id: string) => string): ReactNode {
  switch (a.type) {
    case "created":
      return "created this task";
    case "moved":
      return (
        <>
          moved it from <b className="font-medium">{STATUS_LABELS[a.from]}</b> to <b className="font-medium">{STATUS_LABELS[a.to]}</b>
        </>
      );
    case "updated":
      return (
        <>
          {a.viaRequestId ? "approved a request, changing " : "changed "}
          {a.changes.map((c, i) => (
            <span key={c.field}>
              {i > 0 && "; "}
              <span className="text-muted-foreground">{FIELD_LABELS[c.field].toLowerCase()}</span>{" "}
              {c.field === "description" ? "updated" : (
                <>
                  to <b className="font-medium">{formatFieldValue(c.field, c.to, lookups)}</b>
                </>
              )}
            </span>
          ))}
        </>
      );
    case "change_requested":
      return `requested changes to ${a.fields.map((f) => FIELD_LABELS[f].toLowerCase()).join(", ")}`;
    case "change_approved":
      return `approved ${nameOf(a.requesterId)}'s request`;
    case "change_rejected":
      return `rejected ${nameOf(a.requesterId)}'s request${a.note ? `: “${a.note}”` : ""}`;
    case "commented":
      return "commented";
    case "subtask_added":
      return (
        <>
          added subtask <b className="font-medium">{a.title}</b>
        </>
      );
    case "checklist_added":
      return `added “${a.text}” to the checklist`;
    case "checklist_checked":
      return `${a.done ? "checked" : "unchecked"} “${a.text}”`;
    case "checklist_removed":
      return `removed “${a.text}” from the checklist`;
    default:
      return "made a change";
  }
}
