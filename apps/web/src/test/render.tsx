import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { Toaster } from "sonner";
import { AppRoutes } from "@/app";

/** Mount the whole app at a URL, as a signed-in (or signed-out) user per `fakeApi.me`. */
export function renderApp(url = "/") {
  const user = userEvent.setup();
  const result = render(
    <MemoryRouter initialEntries={[url]}>
      <AppRoutes />
    </MemoryRouter>,
  );
  return { user, ...result };
}

/**
 * Mount one component inside a router, matched against `path` so hooks like useWorkspaceId work.
 * Includes the toaster so tests can assert on toast messages.
 */
export function renderWithRouter(ui: ReactElement, { url = "/w/ws_1/tasks", path = "/w/:workspaceId/tasks" } = {}) {
  const user = userEvent.setup();
  const result = render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path={path} element={ui} />
      </Routes>
      <Toaster />
    </MemoryRouter>,
  );
  return { user, ...result };
}
