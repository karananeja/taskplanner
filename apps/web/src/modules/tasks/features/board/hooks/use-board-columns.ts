import { groupByStatus } from "@tp/data-stores";
import { TASK_STATUSES, type TaskCard } from "@tp/shared";
import { useMemo } from "react";
import { useMe } from "@/hooks/use-auth";
import { useBoard } from "@/hooks/use-tasks";
import { useBoardFilters } from "../stores/board-filters";

/** Board data with the current filters applied, grouped into columns. Derived in render. */
export function useBoardColumns(wid: string) {
  const board = useBoard(wid);
  const myId = useMe().data?.user.id;
  const { search, assignee, labelId, clientId } = useBoardFilters();

  const columns = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = (t: TaskCard) => {
      if (q && !t.title.toLowerCase().includes(q) && !t.parent?.title.toLowerCase().includes(q)) return false;
      if (assignee === "me" && !(myId && t.assigneeIds.includes(myId))) return false;
      if (assignee === "unassigned" && t.assigneeIds.length > 0) return false;
      if (!["all", "me", "unassigned"].includes(assignee) && !t.assigneeIds.includes(assignee)) return false;
      if (labelId !== "all" && !t.labelIds.includes(labelId)) return false;
      if (clientId !== "all" && t.clientId !== clientId) return false;
      return true;
    };
    return groupByStatus((board.data ?? []).filter(matches), TASK_STATUSES);
  }, [board.data, search, assignee, labelId, clientId, myId]);

  const isFiltered = search.trim() !== "" || assignee !== "all" || labelId !== "all" || clientId !== "all";
  return { columns, status: board.status, error: board.error, isFiltered, hasTasks: (board.data?.length ?? 0) > 0 };
}
