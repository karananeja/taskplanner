import { useEffect } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useParams } from "react-router";
import { Toaster } from "sonner";
import { AppShell } from "@/components/app-shell/app-shell";
import { FullPageMessage } from "@/components/full-page-message";
import { useMe } from "@/hooks/use-auth";
import { LoginPage } from "@/modules/auth/features/login/login-page";
import { OnboardingPage } from "@/modules/auth/features/onboarding/onboarding-page";
import { SignupPage } from "@/modules/auth/features/signup/signup-page";
import { defaultModule, modules } from "@/modules/registry";
import { applyTheme, useUiStore } from "@/stores/ui-store";

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

/** All routes, without a router, so tests can mount them in a MemoryRouter. */
export function AppRoutes() {
  const theme = useUiStore((s) => s.theme);
  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  return (
    <>
      <Routes>
        <Route element={<SignedOutOnly />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
        </Route>
        <Route element={<SignedInOnly />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/w/:workspaceId" element={<WorkspaceGate />}>
            <Route index element={<Navigate to={defaultModule.path} replace />} />
            {modules.map((m) => (
              <Route key={m.id} path={`${m.path}/*`} element={<m.Screen />} />
            ))}
          </Route>
          <Route path="*" element={<HomeRedirect />} />
        </Route>
      </Routes>
      <Toaster theme={theme} position="bottom-right" toastOptions={{ className: "!bg-popover !text-popover-foreground !border-border" }} />
    </>
  );
}

function useSession() {
  const me = useMe();
  return { me: me.data, loading: me.status === "idle" || me.status === "loading", error: me.status === "error" };
}

function SignedOutOnly() {
  const { me, loading } = useSession();
  if (loading) return <FullPageMessage loading />;
  if (me) return <Navigate to="/" replace />;
  return <Outlet />;
}

function SignedInOnly() {
  const { me, loading, error } = useSession();
  if (loading) return <FullPageMessage loading />;
  if (error) return <FullPageMessage title="Can't reach the server" body="Check that the API is running on port 4000, then reload." />;
  if (!me) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function HomeRedirect() {
  const { me } = useSession();
  const last = useUiStore((s) => s.lastWorkspaceId);
  if (!me) return null;
  if (me.workspaces.length === 0) return <Navigate to="/onboarding" replace />;
  const target = me.workspaces.find((w) => w.id === last) ?? me.workspaces[0]!;
  return <Navigate to={`/w/${target.id}/${defaultModule.path}`} replace />;
}

/** Only render a workspace the user belongs to; remember it for next time. */
function WorkspaceGate() {
  const { workspaceId } = useParams();
  const { me } = useSession();
  const setLast = useUiStore((s) => s.setLastWorkspaceId);
  const isMember = Boolean(me?.workspaces.some((w) => w.id === workspaceId));
  useEffect(() => {
    if (isMember && workspaceId) setLast(workspaceId);
  }, [isMember, workspaceId, setLast]);
  if (!isMember) return <HomeRedirect />;
  return <AppShell key={workspaceId} />;
}
