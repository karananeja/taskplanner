import { errorMessage } from "@tp/data-stores";
import { NOTIFICATION_LABELS, NOTIFICATION_TYPES, type Notification, type NotificationType } from "@tp/shared";
import { Loader2, MailOpen, Mail } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { inboxStore, useInbox, useNotificationSettings, useUnreadCount } from "@/hooks/use-inbox";
import { useWorkspaceId } from "@/hooks/use-workspace";
import { timeAgo } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { TaskPanelHost, useOpenTask } from "@/modules/tasks/features/task-panel/task-panel-host";

const VERBS: Record<NotificationType, string> = {
  ASSIGNED: "assigned you to",
  MENTIONED: "mentioned you on",
  CHANGE_REQUESTED: "requested a change to",
  CHANGE_APPROVED: "approved your change to",
  CHANGE_REJECTED: "rejected your change to",
};

export function InboxPage() {
  const wid = useWorkspaceId();
  const { data, status, error } = useInbox(wid);
  const unread = useUnreadCount(wid);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { openTask } = useOpenTask();

  const shown = (data ?? []).filter((n) => filter === "all" || !n.readAt);

  const run = (p: Promise<unknown>) => p.catch((e) => toast.error(errorMessage(e)));
  const open = (n: Notification) => {
    if (!n.readAt) void run(inboxStore().markRead(wid, n.id));
    if (n.task) openTask(n.task.id);
  };

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <div className="flex items-center gap-2">
          <h1 className="mr-1 text-lg font-semibold tracking-tight">Inbox</h1>
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
            All
          </FilterChip>
          <FilterChip active={filter === "unread"} onClick={() => setFilter("unread")}>
            Unread ({unread})
          </FilterChip>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={unread === 0} onClick={() => void run(inboxStore().markAllRead(wid))}>
            Mark all as read
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
            Notification settings
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-5 py-4">
          {status === "loading" || status === "idle" ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading notifications" />
            </div>
          ) : status === "error" ? (
            <p className="text-sm text-destructive">Couldn't load your inbox: {errorMessage(error)}</p>
          ) : shown.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {filter === "unread" ? "You're all caught up." : "Nothing here yet. Assignments, mentions and change requests will show up here."}
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {shown.map((n) => (
                <li key={n.id} className={cn("group flex items-center gap-3 rounded-lg border px-3 py-2.5", !n.readAt && "bg-card")}>
                  <span className={cn("size-1.5 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} aria-label={n.readAt ? undefined : "Unread"} />
                  {n.actor ? <Avatar user={n.actor} /> : <span className="size-6 shrink-0" />}
                  <button type="button" onClick={() => open(n)} className="min-w-0 flex-1 text-left text-sm">
                    <span className="font-medium">{n.actor?.name ?? "Someone"}</span>{" "}
                    <span className="text-muted-foreground">{VERBS[n.type] ?? "updated"}</span>{" "}
                    <span className="font-medium">{n.task?.title ?? n.data.title ?? "a deleted task"}</span>
                    {(n.data.excerpt || n.data.note) && (
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{n.data.excerpt ?? n.data.note}</span>
                    )}
                  </button>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label={n.readAt ? "Mark as unread" : "Mark as read"}
                    title={n.readAt ? "Mark as unread" : "Mark as read"}
                    onClick={() => void run(inboxStore().markRead(wid, n.id, !n.readAt))}
                  >
                    {n.readAt ? <Mail /> : <MailOpen />}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <NotificationSettingsDialog wid={wid} open={settingsOpen} onOpenChange={setSettingsOpen} />
      <TaskPanelHost wid={wid} />
    </>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-7 rounded-full px-3 text-xs transition-colors",
        active ? "bg-primary text-primary-foreground" : "border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function NotificationSettingsDialog({ wid, open, onOpenChange }: { wid: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: prefs } = useNotificationSettings(wid, open);
  const [saving, setSaving] = useState<NotificationType | null>(null);

  const toggle = async (type: NotificationType, on: boolean) => {
    setSaving(type);
    try {
      await inboxStore().updateSettings(wid, { [type]: on });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Notification settings</DialogTitle>
          <DialogDescription>Choose what lands in your inbox for this workspace.</DialogDescription>
        </DialogHeader>
        {!prefs ? (
          <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" aria-label="Loading settings" />
        ) : (
          <ul className="divide-y rounded-lg border">
            {NOTIFICATION_TYPES.map((t) => (
              <li key={t}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm">{NOTIFICATION_LABELS[t].label}</span>
                    <span className="block text-xs text-muted-foreground">{NOTIFICATION_LABELS[t].description}</span>
                  </span>
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--color-primary)]"
                    checked={prefs[t]}
                    disabled={saving === t}
                    onChange={(e) => void toggle(t, e.target.checked)}
                  />
                </label>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
