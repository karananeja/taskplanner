import { useQuery } from "@tp/query/react";
import { globalStore } from "@/store/global-store";

export const authStore = () => globalStore.auth;

export function useMe() {
  return useQuery(globalStore.auth.me);
}

export function useAuthConfig() {
  return useQuery(globalStore.auth.config).data ?? { google: false };
}
