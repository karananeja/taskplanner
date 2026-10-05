import { useQuery } from "@tp/query/react";
import { useMemo } from "react";
import { globalStore } from "@/store/global-store";

export const inboxStore = () => globalStore.inbox;

export function useInbox(wid: string) {
  return useQuery(useMemo(() => globalStore.inbox.list(wid), [wid]));
}

export function useUnreadCount(wid: string) {
  const list = useInbox(wid).data;
  return useMemo(() => list?.filter((n) => !n.readAt).length ?? 0, [list]);
}

export function useNotificationSettings(wid: string, enabled: boolean) {
  return useQuery(useMemo(() => (enabled ? globalStore.inbox.settings(wid) : null), [wid, enabled]));
}
