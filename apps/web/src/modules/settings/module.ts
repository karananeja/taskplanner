import { Settings } from "lucide-react";
import { defineModule } from "../define-module";
import { WorkspaceSettingsPage } from "./features/workspace-settings/workspace-settings-page";

export const settingsModule = defineModule({
  id: "settings",
  path: "settings",
  nav: { label: "Settings", icon: Settings, order: 90 },
  Screen: WorkspaceSettingsPage,
});
