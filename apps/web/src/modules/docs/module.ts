import { FileText } from "lucide-react";
import { defineModule } from "../define-module";
import { DocsScreen } from "./features/docs-screen";

export const docsModule = defineModule({
  id: "docs",
  path: "docs",
  nav: { label: "Docs", icon: FileText, order: 50 },
  Screen: DocsScreen,
});
