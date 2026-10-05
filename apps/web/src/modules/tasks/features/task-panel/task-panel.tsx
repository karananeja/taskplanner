import { errorMessage, isApiError } from "@tp/data-stores";
import { Loader2, MoreHorizontal, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { taskStore, useTask } from "@/hooks/use-tasks";
import { formatDate } from "@/lib/dates";
import { ChangeRequests } from "./components/change-requests";
import { Checklist } from "./components/checklist";
import { Comments } from "./components/comments";
import { DetailsForm } from "./components/details-form";
import { History } from "./components/history";
import { Subtasks } from "./components/subtasks";

export function TaskPanel({
  wid,
  taskId,
  onOpenTask,
  onClose,
}: {
  wid: string;
  taskId: string;
  onOpenTask: (id: string) => void;
  onClose: () => void;
}) {
  const { data: task, status, error } = useTask(wid, taskId);
  const [tab, setTab] = useState("details");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    setDeleting(true);
    try {
      await taskStore().remove(wid, taskId);
      toast.success("Task deleted");
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
      setDeleting(false);
    }
  };

  const notFound = status === "error" && isApiError(error) && error.status === 404;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <SheetContent aria-describedby={undefined}>
        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 border-b px-5 py-3">
          <div className="flex items-center gap-3">
            <Button size="sm" variant="outline" onClick={onClose}>
              <X /> Close
            </Button>
            <TabsList aria-label="Task sections">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
          </div>
          {task?.permissions.canDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirmDelete(true)}>
                  <Trash2 /> Delete task
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {!task ? (
            notFound ? (
              <div className="py-16 text-center">
                <SheetTitle>This task no longer exists</SheetTitle>
                <SheetDescription className="mt-1">It may have been deleted by an owner.</SheetDescription>
              </div>
            ) : status === "error" ? (
              <p className="text-sm text-destructive">{errorMessage(error)}</p>
            ) : (
              <div className="flex justify-center py-16">
                <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading task" />
              </div>
            )
          ) : (
            <>
              <SheetTitle className="sr-only">{task.title}</SheetTitle>
              <p className="mb-3 text-xs text-muted-foreground">
                Created by {task.createdBy.name} on {formatDate(task.createdAt.slice(0, 10))}
              </p>
              <TabsContent value="details" className="flex flex-col gap-8 outline-none">
                  <ChangeRequests wid={wid} task={task} />
                  {/* Remount the form when switching tasks so drafts never leak between them. */}
                  <DetailsForm key={task.id} wid={wid} task={task} />
                  <Subtasks wid={wid} task={task} onOpenTask={onOpenTask} />
                  <Checklist wid={wid} task={task} />
                  <Comments wid={wid} taskId={task.id} />
                </TabsContent>
                <TabsContent value="history" className="outline-none">
                  <History wid={wid} taskId={task.id} />
                </TabsContent>
            </>
          )}
        </div>
        </Tabs>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this task?</DialogTitle>
            <DialogDescription>
              “{task?.title}” and its subtasks, checklist, comments and history will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={remove} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </SheetContent>
    </Dialog>
  );
}
