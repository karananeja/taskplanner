import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";

/**
 * A top-level area of the app. The router and sidebar are generated from the registered modules,
 * so adding a screen (Home, Inbox, Calendar…) means adding a module, not editing the shell.
 */
export interface AppModule {
  id: string;
  /** Path under /w/:workspaceId/ */
  path: string;
  nav: {
    label: string;
    icon: LucideIcon;
    order: number;
    /** Optional count shown next to the label, e.g. unread notifications. A hook: called during render. */
    useBadge?: (workspaceId: string) => number;
  };
  Screen: ComponentType;
}

export const defineModule = (m: AppModule) => m;
