import { errorMessage } from "@tp/data-stores";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useWorkspaceId } from "@/hooks/use-workspace";
import { TaskPanelHost, useOpenTask } from "../task-panel/task-panel-host";
import { Board } from "./components/board";
import { BoardToolbar } from "./components/board-toolbar";
import { NewTaskDialog } from "./components/new-task-dialog";
import { useBoardColumns } from "./hooks/use-board-columns";

export function BoardPage() {
  const wid = useWorkspaceId();
  const { columns, status, error, isFiltered } = useBoardColumns(wid);
  const { openTask } = useOpenTask();
  const [newOpen, setNewOpen] = useState(false);

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight">Tasks</h1>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus /> New task
          </Button>
        </div>
        <BoardToolbar wid={wid} isFiltered={isFiltered} />
      </header>

      <div className="min-h-0 flex-1 pt-4">
        {status === "loading" || status === "idle" ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading tasks" />
          </div>
        ) : status === "error" ? (
          <p className="px-5 text-sm text-destructive">Couldn't load tasks: {errorMessage(error)}</p>
        ) : (
          <Board wid={wid} columns={columns} onOpen={openTask} />
        )}
      </div>

      <NewTaskDialog wid={wid} open={newOpen} onOpenChange={setNewOpen} onCreated={openTask} />
      <TaskPanelHost wid={wid} />
    </>
  );
}
