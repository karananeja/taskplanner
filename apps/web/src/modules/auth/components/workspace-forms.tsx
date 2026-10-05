import { zodResolver } from "@hookform/resolvers/zod";
import { createWorkspaceSchema, joinWorkspaceSchema } from "@tp/shared";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { workspaceStore } from "@/hooks/use-workspace";
import { applyServerError } from "@/lib/form-errors";

export function CreateWorkspaceForm({ onDone }: { onDone: (workspaceId: string) => void }) {
  const form = useForm<z.infer<typeof createWorkspaceSchema>>({ resolver: zodResolver(createWorkspaceSchema), defaultValues: { name: "" } });
  const { errors, isSubmitting } = form.formState;
  const onSubmit = form.handleSubmit(async ({ name }) => {
    try {
      onDone(await workspaceStore().create(name));
      form.reset();
    } catch (e) {
      applyServerError(e, form.setError, ["name"]);
    }
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <Input placeholder="Workspace name" aria-label="Workspace name" aria-invalid={!!errors.name} {...form.register("name")} className="max-w-64" />
        <Button type="submit" disabled={isSubmitting}>Create workspace</Button>
      </div>
      <FieldError message={errors.name?.message ?? errors.root?.message} />
    </form>
  );
}

export function JoinWorkspaceForm({ onDone }: { onDone: (workspaceId: string) => void }) {
  const form = useForm<z.infer<typeof joinWorkspaceSchema>>({ resolver: zodResolver(joinWorkspaceSchema), defaultValues: { inviteCode: "" } });
  const { errors, isSubmitting } = form.formState;
  const onSubmit = form.handleSubmit(async ({ inviteCode }) => {
    try {
      onDone(await workspaceStore().join(inviteCode));
      form.reset();
    } catch (e) {
      applyServerError(e, form.setError, ["inviteCode"]);
    }
  });
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <Input placeholder="Invite code" aria-label="Invite code" autoComplete="off" spellCheck={false} aria-invalid={!!errors.inviteCode} {...form.register("inviteCode")} className="max-w-64 font-mono" />
        <Button type="submit" variant="outline" disabled={isSubmitting}>Join workspace</Button>
      </div>
      <FieldError message={errors.inviteCode?.message ?? errors.root?.message} />
    </form>
  );
}
