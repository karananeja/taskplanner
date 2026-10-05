import type { UserSummary } from "@tp/shared";
import { cn, initials } from "@/lib/utils";

/** Stable per-person colour so the same teammate always looks the same. */
const PALETTE = ["#7c3aed", "#4f46e5", "#0891b2", "#059669", "#d97706", "#db2777", "#2563eb", "#9333ea"];
function colorFor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function Avatar({ user, className }: { user: Pick<UserSummary, "id" | "name" | "avatarUrl">; className?: string }) {
  const base = cn("inline-flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-semibold text-white", className);
  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className={cn(base, "object-cover")} />;
  }
  return (
    <span className={base} style={{ backgroundColor: colorFor(user.id) }} aria-hidden>
      {initials(user.name) || "?"}
    </span>
  );
}

export function AvatarStack({ users, max = 3 }: { users: Pick<UserSummary, "id" | "name" | "avatarUrl">[]; max?: number }) {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <span className="flex items-center -space-x-1.5" title={users.map((u) => u.name).join(", ")}>
      {shown.map((u) => (
        <Avatar key={u.id} user={u} className="ring-2 ring-card" />
      ))}
      {extra > 0 && (
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground ring-2 ring-card">
          +{extra}
        </span>
      )}
    </span>
  );
}
