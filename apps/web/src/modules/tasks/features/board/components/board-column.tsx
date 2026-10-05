import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { STATUS_LABELS, type TaskCard, type TaskStatus } from "@tp/shared";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@tp/data-stores";
import { Input } from "@/components/ui/input";
import { taskStore } from "@/hooks/use-tasks";
import { cn } from "@/lib/utils";
import { type CardLookups, SortableTaskCard } from "./task-card";

export const columnDropId = (status: TaskStatus) => `column:${status}`;

export function BoardColumn({
  wid,
  status,
  ids,
  byId,
  lookups,
  onOpen,
}: {
  wid: string;
  status: TaskStatus;
  ids: string[];
  byId: Map<string, TaskCard>;
  lookups: CardLookups;
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnDropId(status), data: { type: "column", status } });

  return (
    <section
      aria-label={STATUS_LABELS[status]}
      className={cn("flex h-full w-72 shrink-0 flex-col rounded-xl border bg-muted/40 transition-colors", isOver && "border-primary/50")}
    >
      <header className="flex items-center justify-between px-3 pt-3 pb-2">
        <h2 className="text-sm font-medium">{STATUS_LABELS[status]}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">{ids.length}</span>
      </header>
      <SortableContext id={status} items={ids} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
          {ids.map((id) => {
            const task = byId.get(id);
            return task ? <SortableTaskCard key={id} task={task} lookups={lookups} onOpen={onOpen} /> : null;
          })}
        </ul>
      </SortableContext>
      <QuickAdd wid={wid} status={status} />
    </section>
  );
}

function QuickAdd({ wid, status }: { wid: string; status: TaskStatus }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const t = title.trim();
    if (!t) return setOpen(false);
    setSaving(true);
    try {
      await taskStore().create(wid, { title: t, status });
      setTitle("");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="m-2 mt-0 flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Plus className="size-3.5" aria-hidden /> Add task
      </button>
    );
  }
  return (
    <form
      className="m-2 mt-0"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Input
        autoFocus
        value={title}
        disabled={saving}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => !title.trim() && setOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && (setTitle(""), setOpen(false))}
        placeholder="Task title, then Enter"
        aria-label={`New task in ${STATUS_LABELS[status]}`}
        className="h-8 bg-card"
      />
    </form>
  );
}
