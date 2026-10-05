import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClients, useLabels, useMembers } from "@/hooks/use-workspace";
import { useBoardFilters } from "../stores/board-filters";

export function BoardToolbar({ wid, isFiltered }: { wid: string; isFiltered: boolean }) {
  const f = useBoardFilters();
  const members = useMembers(wid);
  const labels = useLabels(wid);
  const clients = useClients(wid);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={f.search}
          onChange={(e) => f.setSearch(e.target.value)}
          placeholder="Search tasks…"
          aria-label="Search tasks"
          className="h-8 w-56 pl-8"
        />
      </div>
      <Select value={f.assignee} onValueChange={f.setAssignee}>
        <SelectTrigger className="h-8 w-40" aria-label="Filter by assignee">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Everyone</SelectItem>
          <SelectItem value="me">Assigned to me</SelectItem>
          <SelectItem value="unassigned">Unassigned</SelectItem>
          {members.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={f.labelId} onValueChange={f.setLabelId}>
        <SelectTrigger className="h-8 w-36" aria-label="Filter by label">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All labels</SelectItem>
          {labels.map((l) => (
            <SelectItem key={l.id} value={l.id}>
              {l.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={f.clientId} onValueChange={f.setClientId}>
        <SelectTrigger className="h-8 w-36" aria-label="Filter by client">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All clients</SelectItem>
          {clients.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isFiltered && (
        <Button variant="ghost" size="sm" onClick={f.reset}>
          <X /> Clear filters
        </Button>
      )}
    </div>
  );
}
