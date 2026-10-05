import { useQuery } from "@tp/query/react";
import { useMemo } from "react";
import { globalStore } from "@/store/global-store";

export const docStore = () => globalStore.docs;

export function useDocs(wid: string) {
  return useQuery(useMemo(() => globalStore.docs.list(wid), [wid]));
}

export function useDoc(wid: string, id: string | null) {
  return useQuery(useMemo(() => (id ? globalStore.docs.doc(wid, id) : null), [wid, id]));
}
