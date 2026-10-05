import { create } from "zustand";

export type AssigneeFilter = "all" | "me" | "unassigned" | (string & {});

interface BoardFilters {
  search: string;
  assignee: AssigneeFilter;
  labelId: string;
  clientId: string;
  setSearch: (v: string) => void;
  setAssignee: (v: AssigneeFilter) => void;
  setLabelId: (v: string) => void;
  setClientId: (v: string) => void;
  reset: () => void;
}

const initial = { search: "", assignee: "all" as AssigneeFilter, labelId: "all", clientId: "all" };

/** Board filter chrome. Feature-scoped UI state, not server data. */
export const useBoardFilters = create<BoardFilters>()((set) => ({
  ...initial,
  setSearch: (search) => set({ search }),
  setAssignee: (assignee) => set({ assignee }),
  setLabelId: (labelId) => set({ labelId }),
  setClientId: (clientId) => set({ clientId }),
  reset: () => set(initial),
}));
