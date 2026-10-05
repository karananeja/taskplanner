import { CLOSED_STATUSES, type TaskCard } from "@tp/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useBoard } from "@/hooks/use-tasks";
import { useWorkspaceId } from "@/hooks/use-workspace";
import { todayISO } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { TaskPanelHost, useOpenTask } from "@/modules/tasks/features/task-panel/task-panel-host";
import { priorityMeta } from "@/modules/tasks/lib/meta";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthTitle = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const MAX_PER_DAY = 4;

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export function CalendarPage() {
  const wid = useWorkspaceId();
  const tasks = useBoard(wid).data;
  const { openTask } = useOpenTask();
  const now = new Date();
  const [month, setMonth] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const today = todayISO();

  const { byDay, undated } = useMemo(() => {
    const byDay = new Map<string, TaskCard[]>();
    const undated: TaskCard[] = [];
    for (const t of tasks ?? []) {
      if (!t.dueDate) {
        undated.push(t);
        continue;
      }
      const list = byDay.get(t.dueDate) ?? [];
      list.push(t);
      byDay.set(t.dueDate, list);
    }
    return { byDay, undated };
  }, [tasks]);

  const first = new Date(month.y, month.m, 1);
  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();
  const leading = first.getDay();
  const cells: (number | null)[] = [...Array<null>(leading).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const shift = (delta: number) => setMonth(({ y, m }) => ({ y: m + delta < 0 ? y - 1 : m + delta > 11 ? y + 1 : y, m: (m + delta + 12) % 12 }));

  return (
    <>
      <header className="flex items-center justify-between gap-3 border-b px-5 py-3">
        <h1 className="text-lg font-semibold tracking-tight">Calendar</h1>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="Previous month" onClick={() => shift(-1)}>
            <ChevronLeft />
          </Button>
          <h2 className="w-36 text-center text-sm font-medium" aria-live="polite">
            {monthTitle.format(first)}
          </h2>
          <Button size="icon" variant="ghost" aria-label="Next month" onClick={() => shift(1)}>
            <ChevronRight />
          </Button>
          <Button size="sm" variant="outline" className="ml-2" onClick={() => setMonth({ y: now.getFullYear(), m: now.getMonth() })}>
            Today
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-4 overflow-auto p-4">
        <div className="flex min-w-[640px] flex-1 flex-col">
          <div className="grid grid-cols-7 pb-2 text-center text-xs text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid flex-1 auto-rows-fr grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day === null) return <div key={`blank-${i}`} />;
              const key = iso(month.y, month.m, day);
              const items = byDay.get(key) ?? [];
              const isToday = key === today;
              return (
                <div key={key} className="flex min-h-24 min-w-0 flex-col gap-0.5 rounded-md border bg-card p-1.5">
                  <span
                    className={cn(
                      "mb-0.5 inline-flex size-6 items-center justify-center self-start rounded-full text-xs text-muted-foreground",
                      isToday && "bg-primary font-semibold text-primary-foreground",
                    )}
                  >
                    {day}
                  </span>
                  {items.slice(0, MAX_PER_DAY).map((t) => (
                    <CalendarItem key={t.id} task={t} overdue={key < today} onOpen={openTask} />
                  ))}
                  {items.length > MAX_PER_DAY && <span className="px-1 text-[11px] text-muted-foreground">+{items.length - MAX_PER_DAY} more</span>}
                </div>
              );
            })}
          </div>
        </div>

        <aside className="w-56 shrink-0 border-l pl-4">
          <h2 className="mb-2 text-xs font-medium text-muted-foreground">No due date</h2>
          {undated.length === 0 ? (
            <p className="text-xs text-muted-foreground">Every task has a due date.</p>
          ) : (
            <ul className="flex flex-col">
              {undated.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => openTask(t.id)} className="w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-muted">
                    {t.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
      <TaskPanelHost wid={wid} />
    </>
  );
}

function CalendarItem({ task, overdue, onOpen }: { task: TaskCard; overdue: boolean; onOpen: (id: string) => void }) {
  const closed = CLOSED_STATUSES.includes(task.status);
  const p = priorityMeta(task.priority);
  return (
    <button
      type="button"
      onClick={() => onOpen(task.id)}
      title={`${task.title} · ${p.label}`}
      className={cn(
        "flex min-w-0 items-center gap-1.5 rounded px-1 py-0.5 text-left text-[11px] hover:bg-muted",
        closed && "text-muted-foreground line-through",
        !closed && overdue && "text-destructive",
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
      <span className="truncate">{task.title}</span>
    </button>
  );
}
