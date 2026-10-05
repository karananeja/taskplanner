import { zodResolver } from "@hookform/resolvers/zod";
import { type LoginInput, loginSchema } from "@tp/shared";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input, PasswordInput } from "@/components/ui/input";
import { authStore, useAuthConfig } from "@/hooks/use-auth";
import { applyServerError } from "@/lib/form-errors";
import {
  AuthLayout,
  GoogleButton,
  OrDivider,
} from "../../components/auth-layout";

export function LoginPage() {
  const { google } = useAuthConfig();
  const [params] = useSearchParams();
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await authStore().login(values);
    } catch (e) {
      applyServerError(e, form.setError, ["email", "password"]);
    }
  });

  const rootError = errors.root?.message ?? params.get("error");

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Pick up where your team left off."
      footer={
        <>
          New here?{" "}
          <Link to="/signup" className="text-accent-foreground hover:underline">
            Create an account
          </Link>
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
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              aria-invalid={!!errors.email}
              {...form.register("email")}
            />
            <FieldError message={errors.email?.message} />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              {...form.register("password")}
            />
            <FieldError message={errors.password?.message} />
          </Field>
          <FieldError message={rootError ?? undefined} />
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </FieldGroup>
      </form>
    </AuthLayout>
  );
}
