import { Inbox } from "lucide-react";
import { defineModule } from "../define-module";
import { InboxPage } from "./features/inbox/inbox-page";
import { useUnreadCount } from "@/hooks/use-inbox";

export const inboxModule = defineModule({
  id: "inbox",
  path: "inbox",
  nav: { label: "Inbox", icon: Inbox, order: 20, useBadge: useUnreadCount },
  Screen: InboxPage,
});
