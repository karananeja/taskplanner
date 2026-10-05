import { SquareKanban } from "lucide-react";
import { defineModule } from "../define-module";
import { BoardPage } from "./features/board/board-page";

export const tasksModule = defineModule({
  id: "tasks",
  path: "tasks",
  nav: { label: "Tasks", icon: SquareKanban, order: 30 },
  Screen: BoardPage,
});
