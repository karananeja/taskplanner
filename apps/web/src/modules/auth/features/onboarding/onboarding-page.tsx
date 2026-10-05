import { Navigate, useNavigate } from "react-router";
import { authStore, useMe } from "@/hooks/use-auth";
import { AuthLayout } from "../../components/auth-layout";
import { CreateWorkspaceForm, JoinWorkspaceForm } from "../../components/workspace-forms";

export function OnboardingPage() {
  const me = useMe().data;
  const navigate = useNavigate();
  if (me && me.workspaces.length > 0) return <Navigate to="/" replace />;
  const go = (id: string) => navigate(`/w/${id}`);

  return (
    <AuthLayout
      title={`Welcome${me ? `, ${me.user.name.split(" ")[0]}` : ""}`}
      subtitle="Tasks live in a workspace. Start one for your team, or join one with an invite code."
      footer={
        <button type="button" className="hover:text-foreground" onClick={() => void authStore().logout()}>
          Sign out
        </button>
      }
    >
      <section>
        <h2 className="text-sm font-medium">Start a workspace</h2>
        <p className="mb-3 text-xs text-muted-foreground">You'll be its owner and can invite teammates.</p>
        <CreateWorkspaceForm onDone={go} />
      </section>
      <section className="mt-8">
        <h2 className="text-sm font-medium">Join your team</h2>
        <p className="mb-3 text-xs text-muted-foreground">Ask a teammate for the invite code shown in their sidebar.</p>
        <JoinWorkspaceForm onDone={go} />
      </section>
    </AuthLayout>
  );
}
