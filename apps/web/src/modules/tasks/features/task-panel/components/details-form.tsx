import { zodResolver } from "@hookform/resolvers/zod";
import { errorMessage, isApiError } from "@tp/data-stores";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskChanges,
  type TaskDetail,
  type TaskFieldKey,
  type TaskFields,
  taskFieldsSchema,
} from "@tp/shared";
import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { type Control, Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { TintBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { taskStore } from "@/hooks/use-tasks";
import { useClients, useLabels, useMembers } from "@/hooks/use-workspace";
import { cn } from "@/lib/utils";
import { PRIORITY_COLORS } from "../../../lib/meta";

const formSchema = taskFieldsSchema.refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate, {
  message: "End date can't be before the start date",
  path: ["endDate"],
});

export const fieldsFromDetail = (t: TaskDetail): TaskFields => ({
  title: t.title,
  description: t.description,
  status: t.status,
  priority: t.priority,
  clientId: t.clientId,
  startDate: t.startDate,
  endDate: t.endDate,
  dueDate: t.dueDate,
  assigneeIds: t.assigneeIds,
  ownerIds: t.ownerIds,
  labelIds: t.labelIds,
});

const NO_CLIENT = "__none__";

export function DetailsForm({ wid, task }: { wid: string; task: TaskDetail }) {
  const members = useMembers(wid);
  const labels = useLabels(wid);
  const clients = useClients(wid);
  const { isOwner, canWorkOn } = task.permissions;

  const form = useForm<TaskFields>({ resolver: zodResolver(formSchema), defaultValues: fieldsFromDetail(task) });
  const { errors, isSubmitting, isDirty, dirtyFields } = form.formState;

  // The version this draft is based on. Server updates flow in when there's no unsaved draft.
  const [baseVersion, setBaseVersion] = useState(task.version);
  const staleDraft = isDirty && task.version !== baseVersion;
  useEffect(() => {
    if (task.version !== baseVersion && !form.formState.isDirty) {
      form.reset(fieldsFromDetail(task));
      setBaseVersion(task.version);
    }
  }, [task, baseVersion, form]);

  const dirtyKeys = Object.keys(dirtyFields) as TaskFieldKey[];
  const needsApproval = !isOwner && dirtyKeys.some((k) => !(k === "status" && canWorkOn));

  const onSubmit = form.handleSubmit(async (values) => {
    const changes = Object.fromEntries(dirtyKeys.map((k) => [k, values[k]])) as TaskChanges;
    try {
      const res = await taskStore().update(wid, task.id, baseVersion, changes);
      form.reset(fieldsFromDetail(res.task));
      setBaseVersion(res.task.version);
      if (res.result === "applied") toast.success("Changes saved");
      else if (res.result === "requested") toast.info("Sent to the task's owners for approval");
      else toast.info("Status updated", { description: "Your other changes were sent to the owners for approval." });
    } catch (e) {
      if (isApiError(e) && e.status === 409) {
        toast.error("Someone else saved this task first", { description: "Choose whether to keep your edits or load theirs." });
      } else {
        toast.error(errorMessage(e));
      }
    }
  });

  /** Take everyone else's latest values, but keep the fields I changed on top. */
  const keepMine = () => {
    form.reset(fieldsFromDetail(task), { keepDirtyValues: true });
    setBaseVersion(task.version);
  };

  const discard = () => {
    form.reset(fieldsFromDetail(task));
    setBaseVersion(task.version);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <Field>
        <label htmlFor="task-title" className="sr-only">Title</label>
        <Textarea
          id="task-title"
          rows={1}
          aria-invalid={!!errors.title}
          className="min-h-0 resize-none border-transparent px-1 text-xl font-semibold tracking-tight hover:border-input"
          {...form.register("title")}
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
        />
        <FieldError message={errors.title?.message} />
      </Field>

      <Field>
        <label htmlFor="task-desc" className="sr-only">Description</label>
        <Textarea id="task-desc" rows={4} placeholder="Add a description…" {...form.register("description")} />
      </Field>

      <PeopleField
        label="Assignees"
        control={form.control}
        name="assigneeIds"
        members={members}
      />
      <div>
        <PeopleField label="Owners" control={form.control} name="ownerIds" members={members} />
        <FieldDescription className="mt-1.5">
          {isOwner ? "Owners can edit this task and approve or reject requests, like you." : "Owners can edit this task and approve or reject requests."}
        </FieldDescription>
        <FieldError message={errors.ownerIds?.message} />
      </div>

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

      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel>Priority</FieldLabel>
          <Controller
            control={form.control}
            name="priority"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger aria-label="Priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      <span className="mr-2 inline-block size-2 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[p] }} aria-hidden />
                      {PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field>
          <FieldLabel>Client</FieldLabel>
          <Controller
            control={form.control}
            name="clientId"
            render={({ field }) => (
              <Select value={field.value ?? NO_CLIENT} onValueChange={(v) => field.onChange(v === NO_CLIENT ? null : v)}>
                <SelectTrigger aria-label="Client"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CLIENT}>No client</SelectItem>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <DateField control={form.control} name="startDate" label="Start date" />
        <DateField control={form.control} name="endDate" label="End date" error={errors.endDate?.message} />
        <DateField control={form.control} name="dueDate" label="Due date" className="col-span-2" />
      </div>

      {labels.length > 0 && (
        <Controller
          control={form.control}
          name="labelIds"
          render={({ field }) => (
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-muted-foreground">Labels</legend>
              <div className="flex flex-wrap gap-1.5">
                {labels.map((l) => {
                  const on = field.value.includes(l.id);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => field.onChange(on ? field.value.filter((x) => x !== l.id) : [...field.value, l.id])}
                      className={cn("rounded-full transition-opacity", !on && "opacity-40 hover:opacity-80")}
                    >
                      <TintBadge color={l.color} className="h-6 px-2.5 text-xs">{l.name}</TintBadge>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
        />
      )}

      <div
        className={cn(
          "sticky bottom-0 z-10 -mx-5 flex items-center justify-between gap-3 border-y bg-muted/95 px-5 py-2.5 backdrop-blur",
          staleDraft && "bg-warning/10",
        )}
      >
        {staleDraft ? (
          <p className="flex items-center gap-2 text-[13px]">
            <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />
            Someone else updated this task.
          </p>
        ) : (
          <p className="text-[13px] text-muted-foreground" aria-live="polite">
            {!isDirty
              ? "All changes saved"
              : needsApproval
                ? "Your edits will go to the owners for approval"
                : "Unsaved changes"}
          </p>
        )}
        <div className="flex gap-2">
          {staleDraft ? (
            <>
              <Button type="button" size="sm" variant="outline" onClick={discard}>Load their version</Button>
              <Button type="button" size="sm" onClick={keepMine}>Keep my edits</Button>
            </>
          ) : (
            <>
              {isDirty && <Button type="button" size="sm" variant="ghost" onClick={discard}>Discard</Button>}
              <Button type="submit" size="sm" disabled={!isDirty || isSubmitting}>
                {isSubmitting ? "Saving…" : needsApproval ? "Send for approval" : "Save changes"}
              </Button>
            </>
          )}
        </div>
      </div>
    </form>
  );
}

function PeopleField({
  label,
  control,
  name,
  members,
}: {
  label: string;
  control: Control<TaskFields>;
  name: "assigneeIds" | "ownerIds";
  members: ReturnType<typeof useMembers>;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-muted-foreground">{label}</legend>
          <div className="flex flex-wrap gap-1.5">
            {members.map((m) => {
              const on = field.value.includes(m.id);
              return (
                <ToggleChip
                  key={m.id}
                  pressed={on}
                  onClick={() => field.onChange(on ? field.value.filter((x) => x !== m.id) : [...field.value, m.id])}
                >
                  <Avatar user={m} />
                  {m.name}
                </ToggleChip>
              );
            })}
          </div>
        </fieldset>
      )}
    />
  );
}

function DateField({
  control,
  name,
  label,
  error,
  className,
}: {
  control: Control<TaskFields>;
  name: "startDate" | "endDate" | "dueDate";
  label: string;
  error?: string;
  className?: string;
}) {
  const id = `task-${name}`;
  return (
    <Field className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Input id={id} type="date" value={field.value ?? ""} aria-invalid={!!error} onChange={(e) => field.onChange(e.target.value || null)} />
        )}
      />
      <FieldError message={error} />
    </Field>
  );
}
