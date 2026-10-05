import { errorMessage } from "@tp/data-stores";
import { CLOSED_STATUSES, STATUS_LABELS, type TaskDetail } from "@tp/shared";
import { CircleCheck, Circle, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { taskStore } from "@/hooks/use-tasks";
import { cn } from "@/lib/utils";

export function Subtasks({ wid, task, onOpenTask }: { wid: string; task: TaskDetail; onOpenTask: (id: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const isSubtask = task.parent !== null;

  const add = async () => {
    const t = title.trim();
    if (!t) return;
    setSaving(true);
    try {
      await taskStore().create(wid, { title: t, parentId: task.id, status: "TODO" });
      setTitle("");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium">Subtasks</h3>
        {!isSubtask && !adding && (
          <Button size="xs" variant="ghost" onClick={() => setAdding(true)}>
            <Plus /> Add subtask
          </Button>
        )}
      </div>
      {isSubtask ? (
        <p className="text-[13px] text-muted-foreground">
          This is a subtask of{" "}
          <button type="button" className="text-accent-foreground hover:underline" onClick={() => onOpenTask(task.parent!.id)}>
            {task.parent!.title}
          </button>
          . Subtasks can't have their own subtasks.
        </p>
      ) : task.subtasks.length === 0 && !adding ? (
        <p className="text-[13px] text-muted-foreground">Break this task into smaller steps that each have their own owner and status.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {task.subtasks.map((s) => {
            const closed = CLOSED_STATUSES.includes(s.status);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onOpenTask(s.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-muted"
                >
                  {closed ? <CircleCheck className="size-4 text-primary" aria-hidden /> : <Circle className="size-4 text-muted-foreground" aria-hidden />}
                  <span className={cn("flex-1 truncate", closed && "text-muted-foreground line-through")}>{s.title}</span>
                  <span className="text-xs text-muted-foreground">{STATUS_LABELS[s.status]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {adding && (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <Input
            autoFocus
            value={title}
            disabled={saving}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
            placeholder="Subtask title"
            aria-label="Subtask title"
            className="h-8"
          />
          <Button size="sm" type="submit" disabled={saving || !title.trim()}>Add</Button>
          <Button size="sm" type="button" variant="ghost" onClick={() => setAdding(false)}>Done</Button>
        </form>
      )}
    </section>
  );
}
