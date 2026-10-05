import { zodResolver } from "@hookform/resolvers/zod";
import { errorMessage } from "@tp/data-stores";
import { type Client, type CreateClientInput, STATUS_LABELS, SWATCHES, createClientSchema } from "@tp/shared";
import { ChevronRight, FileText, Mail, Paperclip, Phone, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SwatchPicker } from "@/components/ui/swatch-picker";
import { useDocs } from "@/hooks/use-docs";
import { useBoard } from "@/hooks/use-tasks";
import { useClients, useWorkspaceDetail, useWorkspaceId, workspaceStore } from "@/hooks/use-workspace";
import { applyServerError } from "@/lib/form-errors";
import { cn } from "@/lib/utils";
import { TaskPanelHost, useOpenTask } from "@/modules/tasks/features/task-panel/task-panel-host";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function ClientsPage() {
  const wid = useWorkspaceId();
  const clients = useClients(wid);
  const isOwner = useWorkspaceDetail(wid).data?.myRole === "OWNER";
  const [addOpen, setAddOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <>
      <header className="flex items-center justify-between gap-3 border-b px-5 py-3">
        <h1 className="text-lg font-semibold tracking-tight">Clients</h1>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus /> Add client
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {clients.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No clients yet. Add one to tag tasks and docs with who they're for.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {clients.map((c) => (
              <ClientRow
                key={c.id}
                wid={wid}
                client={c}
                canRemove={isOwner}
                open={expanded === c.id}
                onToggle={() => setExpanded((cur) => (cur === c.id ? null : c.id))}
              />
            ))}
          </ul>
        )}
      </div>
      <AddClientDialog wid={wid} open={addOpen} onOpenChange={setAddOpen} />
      <TaskPanelHost wid={wid} />
    </>
  );
}

function ClientRow({ wid, client: c, canRemove, open, onToggle }: { wid: string; client: Client; canRemove: boolean; open: boolean; onToggle: () => void }) {
  return (
    <li className="rounded-lg border">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50">
        <ChevronRight className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-90")} aria-hidden />
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {plural(c.taskCount, "task")} · {plural(c.docCount, "doc")}
        </span>
      </button>
      {open && <ClientDetail wid={wid} client={c} canRemove={canRemove} />}
    </li>
  );
}

function ClientDetail({ wid, client: c, canRemove }: { wid: string; client: Client; canRemove: boolean }) {
  const tasks = (useBoard(wid).data ?? []).filter((t) => t.clientId === c.id);
  const docs = (useDocs(wid).data ?? []).filter((d) => d.clientId === c.id);
  const { openTask } = useOpenTask();

  const remove = async () => {
    if (!window.confirm(`Delete ${c.name}? Its tasks and docs stay, without a client.`)) return;
    try {
      await workspaceStore().removeClient(wid, c.id);
      toast.success(`${c.name} deleted`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="grid gap-4 border-t px-4 py-3 sm:grid-cols-[1fr_1fr]">
      <div className="flex flex-col gap-1 text-sm sm:col-span-2">
        {c.email && (
          <a href={`mailto:${c.email}`} className="inline-flex items-center gap-2 text-accent-foreground hover:underline">
            <Mail className="size-3.5" /> {c.email}
          </a>
        )}
        {c.phone && (
          <a href={`tel:${c.phone}`} className="inline-flex items-center gap-2 text-accent-foreground hover:underline">
            <Phone className="size-3.5" /> {c.phone}
          </a>
        )}
        {!c.email && !c.phone && <p className="text-xs text-muted-foreground">No contact details.</p>}
      </div>
      <section>
        <h3 className="mb-1 text-xs font-medium text-muted-foreground">Tasks</h3>
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tasks for this client.</p>
        ) : (
          <ul className="-mx-2">
            {tasks.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => openTask(t.id)} className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-muted">
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{STATUS_LABELS[t.status]}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3 className="mb-1 text-xs font-medium text-muted-foreground">Docs</h3>
        {docs.length === 0 ? (
          <p className="text-xs text-muted-foreground">No docs for this client.</p>
        ) : (
          <ul className="-mx-2">
            {docs.map((d) => (
              <li key={d.id}>
                <Link to={`/w/${wid}/docs/${d.id}`} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
                  {d.kind === "file" ? <Paperclip className="size-3.5 text-muted-foreground" /> : <FileText className="size-3.5 text-muted-foreground" />}
                  <span className="truncate">{d.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      {canRemove && (
        <div className="sm:col-span-2">
          <Button size="xs" variant="ghost" className="text-destructive" onClick={remove}>
            <Trash2 /> Delete client
          </Button>
        </div>
      )}
    </div>
  );
}

function AddClientDialog({ wid, open, onOpenChange }: { wid: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const form = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues: { name: "", email: "", phone: "", color: SWATCHES[0] },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      const client = await workspaceStore().addClient(wid, v);
      toast.success(`${client.name} added`);
      form.reset({ name: "", email: "", phone: "", color: v.color });
      onOpenChange(false);
    } catch (e) {
      applyServerError(e, form.setError, ["name", "email", "phone"]);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add client</DialogTitle>
          <DialogDescription>Tag tasks and docs with the client they're for.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="client-name">Name</FieldLabel>
              <Input id="client-name" autoFocus aria-invalid={!!errors.name} {...form.register("name")} />
              <FieldError message={errors.name?.message} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="client-email">Email (optional)</FieldLabel>
                <Input id="client-email" type="email" aria-invalid={!!errors.email} {...form.register("email")} />
                <FieldError message={errors.email?.message} />
              </Field>
              <Field>
                <FieldLabel htmlFor="client-phone">Phone (optional)</FieldLabel>
                <Input id="client-phone" type="tel" {...form.register("phone")} />
              </Field>
            </div>
            <Field>
              <FieldLabel>Colour</FieldLabel>
              <Controller control={form.control} name="color" render={({ field }) => <SwatchPicker value={field.value} onChange={field.onChange} />} />
            </Field>
            <FieldError message={errors.root?.message} />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                Add client
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
