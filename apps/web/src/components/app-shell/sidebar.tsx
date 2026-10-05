import { Check, ChevronDown, Copy, Plus } from "lucide-react";
import { NavLink, useNavigate } from "react-router";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authStore, useMe } from "@/hooks/use-auth";
import { useWorkspaceDetail, useWorkspaceId } from "@/hooks/use-workspace";
import { cn } from "@/lib/utils";
import type { AppModule } from "@/modules/define-module";
import { modules } from "@/modules/registry";
import { ThemeToggle } from "./theme-toggle";

export function Sidebar() {
  const wid = useWorkspaceId();
  const me = useMe().data;
  const detail = useWorkspaceDetail(wid).data;
  const navigate = useNavigate();
  const current = me?.workspaces.find((w) => w.id === wid);

  const signOut = async () => {
    await authStore().logout();
    navigate("/login");
  };

  const copyInvite = async () => {
    if (!detail) return;
    await navigator.clipboard.writeText(detail.inviteCode);
    toast.success("Invite code copied");
  };

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar px-3 py-3">
      <div className="flex items-start justify-between gap-2 px-1">
        <DropdownMenu>
          <DropdownMenuTrigger className="group min-w-0 rounded-md px-1.5 py-1 text-left hover:bg-muted">
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <span className="size-2 rounded-full bg-primary" aria-hidden />
              <span className="truncate">{current?.name ?? "Workspace"}</span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </span>
            <span className="block truncate pl-3.5 text-xs text-muted-foreground">{me?.user.email}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
            {me?.workspaces.map((w) => (
              <DropdownMenuItem key={w.id} onSelect={() => navigate(`/w/${w.id}`)}>
                <span className="flex-1 truncate">{w.name}</span>
                {w.id === wid && <Check className="text-primary" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate(`/w/${wid}/settings#workspaces`)}>
              <Plus /> Create or join a workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button type="button" onClick={signOut} className="mt-1 shrink-0 text-xs text-muted-foreground hover:text-foreground">
          Sign out
        </button>
      </div>

      <nav className="mt-6 flex flex-col gap-0.5" aria-label="Main">
        {modules.map((m) => (
          <NavItem key={m.id} wid={wid} module={m} />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-2">
        <ThemeToggle />
        {detail && (
          <button
            type="button"
            onClick={copyInvite}
            className="group rounded-md border px-2.5 py-2 text-left hover:border-primary/50"
            title="Copy invite code"
          >
            <span className="flex items-center justify-between text-[11px] text-muted-foreground">
              Invite code
              <Copy className="size-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
            </span>
            <span className="block truncate font-mono text-xs text-accent-foreground">{detail.inviteCode}</span>
          </button>
        )}
      </div>
    </aside>
  );
}

const noBadge = () => 0;

function NavItem({ wid, module: m }: { wid: string; module: AppModule }) {
  const badge = (m.nav.useBadge ?? noBadge)(wid);
  return (
    <NavLink
      to={`/w/${wid}/${m.path}`}
      className={({ isActive }) =>
        cn(
          "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors",
          isActive ? "bg-accent font-medium text-accent-foreground ring-1 ring-primary/50" : "text-foreground/80 hover:bg-muted",
        )
      }
    >
      <m.nav.icon className="size-4 opacity-80" aria-hidden />
      <span className="flex-1">{m.nav.label}</span>
      {badge > 0 && (
        <span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-[11px] leading-5 font-medium text-primary-foreground" aria-label={`${badge} unread`}>
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </NavLink>
  );
}
