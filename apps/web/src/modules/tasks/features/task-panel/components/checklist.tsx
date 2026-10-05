import { errorMessage } from "@tp/data-stores";
import type { TaskDetail } from "@tp/shared";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { taskStore } from "@/hooks/use-tasks";
import { cn } from "@/lib/utils";

export function Checklist({ wid, task }: { wid: string; task: TaskDetail }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const editable = task.permissions.canWorkOn;
  const done = task.checklist.filter((c) => c.done).length;
  const s = taskStore();

  const guard = (p: Promise<unknown>) => p.catch((e) => toast.error(errorMessage(e)));

  const add = async () => {
    const t = text.trim();
    if (!t) return;
    setSaving(true);
    try {
      await s.addChecklistItem(wid, task.id, t);
      setText("");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium">Checklist</h3>
        {task.checklist.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {done}/{task.checklist.length}
          </span>
        )}
      </div>
      {task.checklist.length > 0 && (
        <ul className="mb-2 flex flex-col">
          {task.checklist.map((item) => (
            <li key={item.id} className="group flex items-center gap-2.5 rounded-md px-1 py-1 hover:bg-muted/60">
              <button
                type="button"
                role="checkbox"
                aria-checked={item.done}
                aria-label={item.text}
                disabled={!editable}
                onClick={() => guard(s.toggleChecklistItem(wid, task.id, item.id, !item.done))}
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded border transition-colors disabled:cursor-not-allowed",
                  item.done ? "border-primary bg-primary text-primary-foreground" : "border-input",
                )}
              >
                {item.done && <Check className="size-3" strokeWidth={3} />}
              </button>
              <span className={cn("flex-1 text-[13px]", item.done && "text-muted-foreground line-through")}>{item.text}</span>
              {editable && (
                <button
                  type="button"
                  aria-label={`Remove ${item.text}`}
                  onClick={() => guard(s.removeChecklistItem(wid, task.id, item.id))}
                  className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <Input value={text} disabled={saving} onChange={(e) => setText(e.target.value)} placeholder="Add an item…" aria-label="New checklist item" className="h-8" />
        </form>
      ) : (
        task.checklist.length === 0 && <p className="text-[13px] text-muted-foreground">No checklist yet. Owners and assignees can add items.</p>
      )}
    </section>
  );
}
