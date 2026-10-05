import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "system" | "light" | "dark";

interface UiState {
  theme: Theme;
  lastWorkspaceId: string | null;
  setTheme: (theme: Theme) => void;
  setLastWorkspaceId: (id: string | null) => void;
}

/** App-shell preferences only. No server data lives here. */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: "system",
      lastWorkspaceId: null,
      setTheme: (theme) => set({ theme }),
      setLastWorkspaceId: (lastWorkspaceId) => set({ lastWorkspaceId }),
    }),
    { name: "tp-ui" },
  ),
);

export function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}
