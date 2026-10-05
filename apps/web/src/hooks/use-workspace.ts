import type { Member } from "@tp/shared";
import { useQuery } from "@tp/query/react";
import { useMemo } from "react";
import { useParams } from "react-router";
import { globalStore } from "@/store/global-store";

export const workspaceStore = () => globalStore.workspaces;

/** The workspace in the URL. Routes under /w/:workspaceId guarantee it's present. */
export function useWorkspaceId(): string {
  const { workspaceId } = useParams();
  if (!workspaceId) throw new Error("useWorkspaceId used outside a workspace route");
  return workspaceId;
}

export function useWorkspaceDetail(wid: string) {
  return useQuery(useMemo(() => globalStore.workspaces.detail(wid), [wid]));
}

export function useMembers(wid: string): Member[] {
  return useWorkspaceDetail(wid).data?.members ?? EMPTY;
}

export function useMemberMap(wid: string) {
  const members = useMembers(wid);
  return useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
}

export function useLabels(wid: string) {
  return useQuery(useMemo(() => globalStore.workspaces.labels(wid), [wid])).data ?? EMPTY;
}

export function useClients(wid: string) {
  return useQuery(useMemo(() => globalStore.workspaces.clients(wid), [wid])).data ?? EMPTY;
}

export function useReviewQueue(wid: string) {
  return useQuery(useMemo(() => globalStore.workspaces.reviewQueue(wid), [wid]));
}

const EMPTY: never[] = [];
