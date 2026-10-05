import { Zap } from "lucide-react";
import { defineModule } from "../define-module";
import { QuickCapturePage } from "./features/capture/quick-capture-page";

export const captureModule = defineModule({
  id: "capture",
  path: "capture",
  nav: { label: "Quick Capture", icon: Zap, order: 70 },
  Screen: QuickCapturePage,
});
