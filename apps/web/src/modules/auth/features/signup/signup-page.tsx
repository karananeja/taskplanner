import { zodResolver } from "@hookform/resolvers/zod";
import { type SignupInput, signupSchema } from "@tp/shared";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input, PasswordInput } from "@/components/ui/input";
import { authStore, useAuthConfig } from "@/hooks/use-auth";
import { applyServerError } from "@/lib/form-errors";
import { AuthLayout, GoogleButton, OrDivider } from "../../components/auth-layout";

export function SignupPage() {
  const { google } = useAuthConfig();
  const form = useForm<SignupInput>({ resolver: zodResolver(signupSchema), defaultValues: { name: "", email: "", password: "" } });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await authStore().signup(values);
    } catch (e) {
      applyServerError(e, form.setError, ["name", "email", "password"]);
    }
  });

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Then start a workspace or join your team's."
      footer={
        <>
          Already have an account? <Link to="/login" className="text-accent-foreground hover:underline">Sign in</Link>
        </>
      }
    >
      {google && (
        <>
          <GoogleButton />
          <OrDivider />
        </>
      )}
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="name">Your name</FieldLabel>
            <Input id="name" autoComplete="name" autoFocus aria-invalid={!!errors.name} {...form.register("name")} />
            <FieldError message={errors.name?.message} />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">Work email</FieldLabel>
            <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...form.register("email")} />
            <FieldError message={errors.email?.message} />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <PasswordInput id="password" autoComplete="new-password" aria-invalid={!!errors.password} {...form.register("password")} />
            {errors.password ? <FieldError message={errors.password.message} /> : <FieldDescription>At least 8 characters.</FieldDescription>}
          </Field>
          <FieldError message={errors.root?.message} />
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating account…" : "Create account"}
          </Button>
        </FieldGroup>
      </form>
    </AuthLayout>
  );
}
