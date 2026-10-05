import { errorMessage } from "@tp/data-stores";
import type { ChangeRequest, TaskDetail, TaskFieldKey } from "@tp/shared";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMe } from "@/hooks/use-auth";
import { taskStore } from "@/hooks/use-tasks";
import { timeAgo } from "@/lib/dates";
import { FIELD_LABELS, formatFieldValue } from "../../../lib/format-field";
import { useFieldLookups } from "../../../hooks/use-field-lookups";

/** Pending edits from non-owners, shown above the form so owners see them first. */
export function ChangeRequests({ wid, task }: { wid: string; task: TaskDetail }) {
  if (task.pendingChangeRequests.length === 0) return null;
  return (
    <section aria-label="Pending change requests" className="flex flex-col gap-2">
      {task.pendingChangeRequests.map((cr) => (
        <ChangeRequestCard key={cr.id} wid={wid} task={task} cr={cr} />
      ))}
    </section>
  );
}

function ChangeRequestCard({ wid, task, cr }: { wid: string; task: TaskDetail; cr: ChangeRequest }) {
  const myId = useMe().data?.user.id;
  const lookups = useFieldLookups(wid);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const isMine = cr.requester.id === myId;

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(done);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const s = taskStore();

  return (
    <div className="rounded-lg border border-primary/40 bg-accent/60 p-3">
      <div className="flex items-center gap-2 text-[13px]">
        <Avatar user={cr.requester} />
        <span>
          <span className="font-medium">{isMine ? "You" : cr.requester.name}</span>
          <span className="text-muted-foreground"> requested changes, {timeAgo(cr.createdAt)}</span>
        </span>
      </div>
      <dl className="mt-2.5 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1.5 text-[13px]">
        {(Object.keys(cr.changes) as TaskFieldKey[]).map((field) => (
          <div key={field} className="contents">
            <dt className="text-muted-foreground">{FIELD_LABELS[field]}</dt>
            <dd className="min-w-0 break-words">
              <span className="text-muted-foreground line-through decoration-muted-foreground/50">
                {formatFieldValue(field, cr.previous[field], lookups)}
              </span>
              <span className="mx-1.5 text-muted-foreground" aria-label="changes to">→</span>
              <span className="font-medium">{formatFieldValue(field, cr.changes[field], lookups)}</span>
            </dd>
          </div>
        ))}
      </dl>

      {task.permissions.isOwner && !rejecting && (
        <div className="mt-3 flex gap-2">
          <Button size="xs" disabled={busy} onClick={() => run(() => s.approveChangeRequest(wid, task.id, cr.id), "Change approved")}>
            Approve
          </Button>
          <Button size="xs" variant="outline" disabled={busy} onClick={() => setRejecting(true)}>
            Reject
          </Button>
        </div>
      )}
      {rejecting && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => s.rejectChangeRequest(wid, task.id, cr.id, note.trim() || undefined), "Change rejected");
          }}
        >
          <Input autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (optional)" className="h-7 text-xs" aria-label="Reason for rejecting" />
          <Button size="xs" variant="destructive" type="submit" disabled={busy}>Reject</Button>
          <Button size="xs" variant="ghost" type="button" onClick={() => setRejecting(false)}>Cancel</Button>
        </form>
      )}
      {!task.permissions.isOwner && isMine && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Waiting for an owner to review.</p>
          <Button size="xs" variant="ghost" disabled={busy} onClick={() => run(() => s.withdrawChangeRequest(wid, task.id, cr.id), "Request withdrawn")}>
            Withdraw
          </Button>
        </div>
      )}
    </div>
  );
}
