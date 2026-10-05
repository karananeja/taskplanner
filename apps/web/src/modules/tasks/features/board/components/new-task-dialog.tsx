import { zodResolver } from "@hookform/resolvers/zod";
import { errorMessage } from "@tp/data-stores";
import { PRIORITY_LABELS, STATUS_LABELS, TASK_PRIORITIES, TASK_STATUSES, taskFieldsSchema } from "@tp/shared";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { taskStore } from "@/hooks/use-tasks";

const schema = taskFieldsSchema.pick({ title: true, description: true, status: true, priority: true, dueDate: true });
type Values = z.infer<typeof schema>;
const defaults: Values = { title: "", description: "", status: "TODO", priority: "NONE", dueDate: null };

export function NewTaskDialog({
  wid,
  open,
  onOpenChange,
  onCreated,
}: {
  wid: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const task = await taskStore().create(wid, values);
      form.reset(defaults);
      onOpenChange(false);
      toast.success("Task created");
      onCreated(task.id);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>You'll be its owner. Add people, dates and details next.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="nt-title">Title</FieldLabel>
              <Input id="nt-title" autoFocus aria-invalid={!!errors.title} {...form.register("title")} />
              <FieldError message={errors.title?.message} />
            </Field>
            <Field>
              <FieldLabel htmlFor="nt-desc">Description</FieldLabel>
              <Textarea id="nt-desc" rows={3} {...form.register("description")} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field>
                <FieldLabel>Status</FieldLabel>
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field>
                <FieldLabel>Priority</FieldLabel>
                <Controller
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-label="Priority"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TASK_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="nt-due">Due date</FieldLabel>
                <Controller
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <Input id="nt-due" type="date" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || null)} />
                  )}
                />
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Creating…" : "Create task"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
