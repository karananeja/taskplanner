import { errorMessage } from "@tp/data-stores";
import { PRIORITY_LABELS, STATUS_LABELS, TASK_PRIORITIES, TASK_STATUSES, type TaskPriority, type TaskStatus } from "@tp/shared";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { taskStore } from "@/hooks/use-tasks";
import { useClients, useMembers, useWorkspaceId } from "@/hooks/use-workspace";
import { formatDate, todayISO } from "@/lib/dates";
import { splitIntoDrafts } from "../../lib/split-lines";

const SOURCES = {
  meeting: "From a meeting",
  list: "From a to-do list",
  email: "From an email",
} as const;
type Source = keyof typeof SOURCES;

const NOBODY = "nobody";
const NO_CLIENT = "none";

interface Draft {
  key: number;
  include: boolean;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string;
  clientId: string;
  dueDate: string;
}

let nextKey = 1;

export function QuickCapturePage() {
  const wid = useWorkspaceId();
  const members = useMembers(wid);
  const clients = useClients(wid);
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [source, setSource] = useState<Source>("meeting");
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [creating, setCreating] = useState(false);

  const split = () => {
    const lines = splitIntoDrafts(text, members);
    if (lines.length === 0) return void toast.error("There's nothing to turn into tasks. Put one item per line.");
    setDrafts(
      lines.map((l) => ({
        key: nextKey++,
        include: true,
        title: l.title,
        status: "TODO",
        priority: "NONE",
        assigneeId: l.assigneeIds[0] ?? NOBODY,
        clientId: NO_CLIENT,
        dueDate: "",
      })),
    );
  };

  const patch = (key: number, changes: Partial<Draft>) => setDrafts((ds) => ds?.map((d) => (d.key === key ? { ...d, ...changes } : d)) ?? null);
  const chosen = drafts?.filter((d) => d.include && d.title.trim()) ?? [];

  const create = async () => {
    setCreating(true);
    const note = `Captured ${SOURCES[source].toLowerCase()} on ${formatDate(todayISO())}.`;
    let made = 0;
    try {
      for (const d of chosen) {
        await taskStore().create(wid, {
          title: d.title.trim(),
          description: note,
          status: d.status,
          priority: d.priority,
          assigneeIds: d.assigneeId === NOBODY ? [] : [d.assigneeId],
          clientId: d.clientId === NO_CLIENT ? null : d.clientId,
          dueDate: d.dueDate || null,
        });
        made++;
        // Created drafts leave the list, so a failure part-way can be retried without duplicates.
        setDrafts((ds) => ds?.filter((x) => x.key !== d.key) ?? null);
      }
      toast.success(`Created ${made} ${made === 1 ? "task" : "tasks"}`, {
        action: { label: "View board", onClick: () => navigate(`/w/${wid}/tasks`) },
      });
      setText("");
      setDrafts(null);
    } catch (e) {
      toast.error(`${made ? `Created ${made}, then: ` : ""}${errorMessage(e)}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="text-lg font-semibold tracking-tight">Quick Capture</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Paste meeting notes or a list of to-dos below. Each line becomes a draft task you can edit before creating.</p>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Notes to split into tasks"
          placeholder={"Paste meeting notes or a list, one item per line…\n- Follow up with design on mockups @Name\n- Send contract to legal"}
          rows={8}
          className="mt-5"
        />
        <div className="mt-3 flex items-center gap-2">
          <Select value={source} onValueChange={(v) => setSource(v as Source)}>
            <SelectTrigger className="h-9 w-44" aria-label="Where these came from">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SOURCES) as Source[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {SOURCES[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={split} disabled={!text.trim() || creating}>
            Split into tasks
          </Button>
          <span className="text-xs text-muted-foreground">Tip: @Name in a line assigns that teammate.</span>
        </div>

        {drafts && drafts.length > 0 && (
          <section className="mt-8" aria-label="Draft tasks">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {drafts.length} draft {drafts.length === 1 ? "task" : "tasks"}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setDrafts(null)} disabled={creating}>
                Discard
              </Button>
            </div>
            <ul className="flex flex-col gap-2">
              {drafts.map((d) => (
                <li key={d.key} className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={d.include}
                      onChange={(e) => patch(d.key, { include: e.target.checked })}
                      aria-label={`Include “${d.title}”`}
                      className="size-4 accent-[var(--color-primary)]"
                    />
                    <Input value={d.title} onChange={(e) => patch(d.key, { title: e.target.value })} aria-label="Task title" className="h-8" />
                    <Button size="icon" variant="ghost" aria-label="Remove draft" onClick={() => setDrafts((ds) => ds?.filter((x) => x.key !== d.key) ?? null)}>
                      <Trash2 />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pl-6 sm:grid-cols-5">
                    <Select value={d.status} onValueChange={(v) => patch(d.key, { status: v as TaskStatus })}>
                      <SelectTrigger className="h-8 text-xs" aria-label="Status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={d.priority} onValueChange={(v) => patch(d.key, { priority: v as TaskPriority })}>
                      <SelectTrigger className="h-8 text-xs" aria-label="Priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {PRIORITY_LABELS[p]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={d.assigneeId} onValueChange={(v) => patch(d.key, { assigneeId: v })}>
                      <SelectTrigger className="h-8 text-xs" aria-label="Assignee">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NOBODY}>Unassigned</SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={d.clientId} onValueChange={(v) => patch(d.key, { clientId: v })}>
                      <SelectTrigger className="h-8 text-xs" aria-label="Client">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_CLIENT}>No client</SelectItem>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input type="date" value={d.dueDate} onChange={(e) => patch(d.key, { dueDate: e.target.value })} aria-label="Due date" className="h-8 text-xs" />
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end">
              <Button onClick={create} disabled={chosen.length === 0 || creating}>
                {creating && <Loader2 className="animate-spin" />}
                Create {chosen.length} {chosen.length === 1 ? "task" : "tasks"}
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
