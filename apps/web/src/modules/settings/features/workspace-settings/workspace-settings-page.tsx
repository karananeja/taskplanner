import { zodResolver } from "@hookform/resolvers/zod";
import { errorMessage } from "@tp/data-stores";
import {
  type CreateClientInput,
  type CreateLabelInput,
  SWATCHES,
  createClientSchema,
  createLabelSchema,
  deleteWorkspaceSchema,
  renameWorkspaceSchema,
} from "@tp/shared";
import { Copy, RefreshCw, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import type { z } from "zod";
import { Avatar } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TintBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SwatchPicker } from "@/components/ui/swatch-picker";
import { useMe } from "@/hooks/use-auth";
import { useClients, useLabels, useWorkspaceDetail, useWorkspaceId, workspaceStore } from "@/hooks/use-workspace";
import { applyServerError } from "@/lib/form-errors";
import { cn } from "@/lib/utils";
import { CreateWorkspaceForm, JoinWorkspaceForm } from "@/modules/auth/components/workspace-forms";

export function WorkspaceSettingsPage() {
  const wid = useWorkspaceId();
  const detail = useWorkspaceDetail(wid).data;
  const navigate = useNavigate();
  const { hash } = useLocation();
  const isOwner = detail?.myRole === "OWNER";

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [hash, detail]);

  if (!detail) return null;

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="border-b px-5 py-3">
        <h1 className="text-lg font-semibold tracking-tight">Workspace settings</h1>
      </header>
      <div className="mx-auto flex max-w-2xl flex-col gap-10 px-5 py-8">
        <Section title="Workspace" description={isOwner ? "Only you can rename it, since you're the owner." : undefined}>
          {isOwner ? <RenameForm wid={wid} name={detail.name} /> : <p className="text-sm">{detail.name}</p>}
        </Section>

        <Section title="Invite code" description="Anyone with this code can join the workspace as a member.">
          <InviteCode wid={wid} code={detail.inviteCode} canRegenerate={isOwner} />
        </Section>

        <Section id="workspaces" title="Other workspaces" description="Start a new workspace or join another team's.">
          <div className="flex flex-col gap-4">
            <CreateWorkspaceForm onDone={(id) => navigate(`/w/${id}`)} />
            <JoinWorkspaceForm onDone={(id) => navigate(`/w/${id}`)} />
          </div>
        </Section>

        <Section title="Members" description={`${detail.members.length} ${detail.members.length === 1 ? "person" : "people"}`}>
          <Members wid={wid} />
        </Section>

        <Section title="Clients" description="Tag tasks with the client they're for.">
          <Clients wid={wid} canRemove={isOwner} />
        </Section>

        <Section title="Labels" description="Group tasks across columns, like Bug or Feature.">
          <Labels wid={wid} canRemove={isOwner} />
        </Section>

        {isOwner && (
          <Section id="danger" title="Delete workspace" description="Permanently deletes this workspace for everyone: its tasks, docs, clients, labels and members. This can't be undone.">
            <DeleteWorkspace wid={wid} name={detail.name} />
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ id, title, description, children }: { id?: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="text-sm font-semibold">{title}</h2>
      {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function RenameForm({ wid, name }: { wid: string; name: string }) {
  const form = useForm<z.infer<typeof renameWorkspaceSchema>>({ resolver: zodResolver(renameWorkspaceSchema), values: { name } });
  const { errors, isSubmitting, isDirty } = form.formState;
  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await workspaceStore().rename(wid, v.name);
      toast.success("Workspace renamed");
    } catch (e) {
      applyServerError(e, form.setError, ["name"]);
    }
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <Input aria-label="Workspace name" className="max-w-64" aria-invalid={!!errors.name} {...form.register("name")} />
        <Button type="submit" variant="outline" disabled={!isDirty || isSubmitting}>Rename</Button>
      </div>
      <FieldError message={errors.name?.message ?? errors.root?.message} />
    </form>
  );
}

function InviteCode({ wid, code, canRegenerate }: { wid: string; code: string; canRegenerate: boolean }) {
  const [busy, setBusy] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    toast.success("Invite code copied");
  };
  const regenerate = async () => {
    setBusy(true);
    try {
      await workspaceStore().regenerateInviteCode(wid);
      toast.success("New invite code created", { description: "The old code no longer works." });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="rounded-md border bg-muted px-3 py-1.5 font-mono text-sm text-accent-foreground">{code}</code>
      <Button size="sm" variant="outline" onClick={copy}>
        <Copy /> Copy
      </Button>
      {canRegenerate && (
        <Button size="sm" variant="ghost" onClick={regenerate} disabled={busy}>
          <RefreshCw /> New code
        </Button>
      )}
    </div>
  );
}

function Members({ wid }: { wid: string }) {
  const detail = useWorkspaceDetail(wid).data!;
  const myId = useMe().data?.user.id;
  const navigate = useNavigate();
  const isOwner = detail.myRole === "OWNER";

  const remove = async (userId: string, name: string) => {
    if (!window.confirm(`Remove ${name} from ${detail.name}? They'll be unassigned from its tasks.`)) return;
    try {
      await workspaceStore().removeMember(wid, userId);
      toast.success(`${name} removed`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const leave = async () => {
    if (!window.confirm(`Leave ${detail.name}? You'll need an invite code to come back.`)) return;
    try {
      await workspaceStore().leave(wid);
      navigate("/");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <ul className="divide-y rounded-lg border">
      {detail.members.map((m) => (
        <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
          <Avatar user={m} className="size-7 text-[11px]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">
              {m.name}
              {m.id === myId && <span className="text-muted-foreground"> (you)</span>}
            </p>
            <p className="truncate text-xs text-muted-foreground">{m.email}</p>
          </div>
          <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", m.role === "OWNER" ? "border-primary/50 text-accent-foreground" : "text-muted-foreground")}>
            {m.role === "OWNER" ? "Owner" : "Member"}
          </span>
          {isOwner && m.id !== myId && (
            <Button size="xs" variant="ghost" onClick={() => remove(m.id, m.name)}>Remove</Button>
          )}
          {!isOwner && m.id === myId && (
            <Button size="xs" variant="ghost" onClick={leave}>Leave</Button>
          )}
        </li>
      ))}
    </ul>
  );
}

function Clients({ wid, canRemove }: { wid: string; canRemove: boolean }) {
  const clients = useClients(wid);
  const form = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues: { name: "", email: "", phone: "", color: SWATCHES[1] },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await workspaceStore().addClient(wid, v);
      form.reset({ name: "", email: "", phone: "", color: v.color });
    } catch (e) {
      applyServerError(e, form.setError, ["name", "email", "phone"]);
    }
  });

  const remove = async (id: string, name: string) => {
    if (!window.confirm(`Delete ${name}? Tasks for this client will keep existing without a client.`)) return;
    try {
      await workspaceStore().removeClient(wid, id);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {clients.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {clients.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{c.name}</p>
                {(c.email || c.phone) && <p className="truncate text-xs text-muted-foreground">{[c.email, c.phone].filter(Boolean).join(", ")}</p>}
              </div>
              <span className="text-xs text-muted-foreground">{c.taskCount} {c.taskCount === 1 ? "task" : "tasks"}</span>
              {canRemove && (
                <Button size="icon" variant="ghost" aria-label={`Delete ${c.name}`} onClick={() => remove(c.id, c.name)}>
                  <X />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <Input placeholder="Client name" aria-label="Client name" aria-invalid={!!errors.name} {...form.register("name")} />
          <Input placeholder="Email (optional)" type="email" aria-label="Client email" aria-invalid={!!errors.email} {...form.register("email")} />
          <Input placeholder="Phone (optional)" aria-label="Client phone" {...form.register("phone")} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Controller control={form.control} name="color" render={({ field }) => <SwatchPicker value={field.value} onChange={field.onChange} />} />
          <Button type="submit" size="sm" disabled={isSubmitting}>Add client</Button>
        </div>
        <FieldError message={errors.name?.message ?? errors.email?.message ?? errors.root?.message} />
      </form>
    </div>
  );
}

function Labels({ wid, canRemove }: { wid: string; canRemove: boolean }) {
  const labels = useLabels(wid);
  const form = useForm<CreateLabelInput>({ resolver: zodResolver(createLabelSchema), defaultValues: { name: "", color: SWATCHES[0] } });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await workspaceStore().addLabel(wid, v);
      form.reset({ name: "", color: v.color });
    } catch (e) {
      applyServerError(e, form.setError, ["name"]);
    }
  });

  const remove = async (id: string, name: string) => {
    if (!window.confirm(`Delete the ${name} label? It'll be removed from every task.`)) return;
    try {
      await workspaceStore().removeLabel(wid, id);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {labels.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {labels.map((l) => (
            <li key={l.id} className="flex items-center gap-0.5">
              <TintBadge color={l.color} className="h-6 px-2.5 text-xs">{l.name}</TintBadge>
              {canRemove && (
                <button type="button" aria-label={`Delete ${l.name}`} onClick={() => remove(l.id, l.name)} className="text-muted-foreground hover:text-foreground">
                  <X className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
        <div className="flex flex-wrap items-center gap-3">
          <Input placeholder="Label name" aria-label="Label name" className="max-w-52" aria-invalid={!!errors.name} {...form.register("name")} />
          <Controller control={form.control} name="color" render={({ field }) => <SwatchPicker value={field.value} onChange={field.onChange} />} />
          <Button type="submit" size="sm" disabled={isSubmitting} className="ml-auto">Add label</Button>
        </div>
        <FieldError message={errors.name?.message ?? errors.root?.message} />
      </form>
    </div>
  );
}

function DeleteWorkspace({ wid, name }: { wid: string; name: string }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const form = useForm<z.infer<typeof deleteWorkspaceSchema>>({ resolver: zodResolver(deleteWorkspaceSchema), defaultValues: { confirmName: "" } });
  const { errors, isSubmitting } = form.formState;
  const matches = form.watch("confirmName").trim() === name.trim();

  const onSubmit = form.handleSubmit(async ({ confirmName }) => {
    try {
      await workspaceStore().deleteWorkspace(wid, confirmName);
      setOpen(false);
      toast.success(`${name} deleted`);
      navigate("/", { replace: true });
    } catch (e) {
      applyServerError(e, form.setError, ["confirmName"]);
    }
  });

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        Delete workspace
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) form.reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {name}?</DialogTitle>
            <DialogDescription>
              Every task, doc, client and label in it is deleted, and all members lose access. Type <strong className="text-foreground">{name}</strong> to confirm.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Input aria-label="Workspace name to confirm" autoComplete="off" autoFocus aria-invalid={!!errors.confirmName} {...form.register("confirmName")} />
              <FieldError message={errors.confirmName?.message ?? errors.root?.message} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={!matches || isSubmitting}>
                {isSubmitting ? "Deleting…" : "Delete forever"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
