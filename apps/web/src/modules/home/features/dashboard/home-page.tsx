import { CLOSED_STATUSES, STATUS_LABELS, TASK_STATUSES, type TaskCard } from "@tp/shared";
import { AlertCircle } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { Link } from "react-router";
import { Avatar } from "@/components/ui/avatar";
import { useMe } from "@/hooks/use-auth";
import { useUnreadCount } from "@/hooks/use-inbox";
import { useBoard } from "@/hooks/use-tasks";
import { useMembers, useReviewQueue, useWorkspaceId } from "@/hooks/use-workspace";
import { formatDay, parseDateOnly, timeAgo, todayISO } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { TaskPanelHost, useOpenTask } from "@/modules/tasks/features/task-panel/task-panel-host";
import { FIELD_LABELS } from "@/modules/tasks/lib/format-field";

const longDate = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function addDaysISO(iso: string, days: number) {
  const d = parseDateOnly(iso);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const isOpen = (t: TaskCard) => !CLOSED_STATUSES.includes(t.status);

export function HomePage() {
  const wid = useWorkspaceId();
  const me = useMe().data;
  const tasks = useBoard(wid).data;
  const reviews = useReviewQueue(wid).data ?? [];
  const unread = useUnreadCount(wid);
  const members = useMembers(wid);
  const { openTask } = useOpenTask();

  const stats = useMemo(() => {
    const all = tasks ?? [];
    const today = todayISO();
    const weekEnd = addDaysISO(today, 7);
    const mine = all.filter((t) => me && t.assigneeIds.includes(me.user.id) && isOpen(t));
    const overdue = mine.filter((t) => t.dueDate && t.dueDate < today);
    const dueWeek = mine.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate <= weekEnd);
    const dueSoon = [...overdue, ...dueWeek].sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));
    const byStatus = TASK_STATUSES.map((s) => ({ key: s, label: STATUS_LABELS[s], count: all.filter((t) => t.status === s).length }));
    const open = all.filter(isOpen);
    const perPerson = members
      .map((m) => ({ key: m.id, label: m.name, member: m, count: open.filter((t) => t.assigneeIds.includes(m.id)).length }))
      .filter((p) => p.count > 0)
      .sort((a, b) => b.count - a.count);
    const unassigned = open.filter((t) => t.assigneeIds.length === 0).length;
    return { mine, overdue, dueWeek, dueSoon, byStatus, perPerson, unassigned, today };
  }, [tasks, me, members]);

  const now = new Date();
  const firstName = me?.user.name.split(" ")[0] ?? "";

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-8">
        <header className="mb-2">
          <h1 className="text-xl font-semibold tracking-tight">
            {greeting(now.getHours())}
            {firstName && `, ${firstName}`}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{longDate.format(now)} · here's where things stand.</p>
        </header>

        <section aria-label="At a glance" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="My open tasks" value={stats.mine.length} hint="Assigned to you" to={`/w/${wid}/tasks`} />
          <StatTile label="Overdue" value={stats.overdue.length} hint="Past their due date" alert={stats.overdue.length > 0} />
          <StatTile label="Due this week" value={stats.dueWeek.length} hint="In the next 7 days" />
          <StatTile label="Awaiting your review" value={reviews.length} hint="Change requests" />
          <StatTile label="Unread in inbox" value={unread} hint="Mentions, assignments, updates" to={`/w/${wid}/inbox`} />
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Due soon — assigned to you">
            {stats.dueSoon.length === 0 ? (
              <Empty>Nothing overdue or due this week.</Empty>
            ) : (
              <ul className="-mx-2 flex flex-col">
                {stats.dueSoon.map((t) => {
                  const late = t.dueDate! < stats.today;
                  return (
                    <li key={t.id}>
                      <button type="button" onClick={() => openTask(t.id)} className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
                        <span className="min-w-0 flex-1 truncate">{t.title}</span>
                        <span className={cn("shrink-0 text-xs", late ? "font-medium text-destructive" : "text-muted-foreground")}>
                          {late ? "Overdue · " : ""}
                          {formatDay(t.dueDate!)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Waiting for your review">
            {reviews.length === 0 ? (
              <Empty>No change requests on tasks you manage.</Empty>
            ) : (
              <ul className="-mx-2 flex flex-col">
                {reviews.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => openTask(r.task.id)} className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
                      <Avatar user={r.requester} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{r.task.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {r.requester.name} wants to change {r.fields.map((f) => FIELD_LABELS[f]?.toLowerCase() ?? f).join(", ")}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(r.createdAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="All tasks by status">
            {!tasks || tasks.length === 0 ? <Empty>No tasks yet.</Empty> : <BarList rows={stats.byStatus} unit="task" />}
          </Card>

          <Card title="Open tasks per person">
            {stats.perPerson.length === 0 ? (
              <Empty>No open tasks are assigned to anyone.</Empty>
            ) : (
              <BarList rows={stats.perPerson} unit="open task" />
            )}
            {stats.unassigned > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Plus {stats.unassigned} open {stats.unassigned === 1 ? "task" : "tasks"} with nobody assigned.
              </p>
            )}
          </Card>
        </div>
      </div>
      <TaskPanelHost wid={wid} />
    </div>
  );
}

function StatTile({ label, value, hint, to, alert }: { label: string; value: number; hint: string; to?: string; alert?: boolean }) {
  const body = (
    <>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-2xl font-semibold tabular-nums">
        {value}
        {alert && <AlertCircle className="size-4 text-destructive" aria-label="Needs attention" />}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
    </>
  );
  const cls = "rounded-lg border bg-card p-3.5 text-left";
  return to ? (
    <Link to={to} className={cn(cls, "transition-colors hover:border-input")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

/** Single-series horizontal bars: one hue, value labelled at the end, hover title for the exact figure. */
function BarList({ rows, unit }: { rows: { key: string; label: string; count: number }[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <table className="w-full border-separate border-spacing-y-1.5 text-[13px]">
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} title={`${r.label}: ${r.count} ${r.count === 1 ? unit : `${unit}s`}`}>
            <th scope="row" className="w-36 max-w-36 truncate pr-3 text-left font-normal text-foreground/80">
              {r.label}
            </th>
            <td className="w-full">
              <div className="flex items-center gap-2">
                <div className="h-2 min-w-0 flex-1">
                  {r.count > 0 && (
                    <div className="h-full min-w-2 rounded-r-[4px] rounded-l-[2px] bg-primary" style={{ width: `${(r.count / max) * 100}%` }} />
                  )}
                </div>
                <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{r.count}</span>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
