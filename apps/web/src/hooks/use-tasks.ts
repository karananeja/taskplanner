import { useQuery } from "@tp/query/react";
import { useMemo } from "react";
import { globalStore } from "@/store/global-store";

export const taskStore = () => globalStore.tasks;

export function useBoard(wid: string) {
  return useQuery(useMemo(() => globalStore.tasks.board(wid), [wid]));
}

export function useTask(wid: string, id: string | null) {
  return useQuery(useMemo(() => (id ? globalStore.tasks.task(wid, id) : null), [wid, id]));
}

export function useComments(wid: string, id: string) {
  return useQuery(useMemo(() => globalStore.tasks.comments(wid, id), [wid, id]));
}

export function useActivity(wid: string, id: string, enabled: boolean) {
  return useQuery(useMemo(() => (enabled ? globalStore.tasks.activity(wid, id) : null), [wid, id, enabled]));
}
