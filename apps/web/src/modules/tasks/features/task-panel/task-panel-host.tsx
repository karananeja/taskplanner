import { useSearchParams } from "react-router";
import { TaskPanel } from "./task-panel";

/** Open and close the task panel through the `?task=` search param, so any screen can deep-link a task. */
export function useOpenTask() {
  const [params, setParams] = useSearchParams();
  const openTaskId = params.get("task");
  const openTask = (id: string | null) =>
    setParams(
      (p) => {
        if (id) p.set("task", id);
        else p.delete("task");
        return p;
      },
      { replace: !id },
    );
  return { openTaskId, openTask };
}

/** Renders the task panel for whichever task is in the URL. */
export function TaskPanelHost({ wid }: { wid: string }) {
  const { openTaskId, openTask } = useOpenTask();
  if (!openTaskId) return null;
  return <TaskPanel key={openTaskId} wid={wid} taskId={openTaskId} onOpenTask={openTask} onClose={() => openTask(null)} />;
}
