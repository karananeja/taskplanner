import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { toast } from "sonner";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { useBoardFilters } from "@/modules/tasks/features/board/stores/board-filters";
import { resetGlobalStore } from "@/store/global-store";
import { useUiStore } from "@/stores/ui-store";
import { resetFakeApi, server } from "./server";

// jsdom gaps that Radix, Sonner and dnd-kit rely on.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.setPointerCapture ??= () => {};
Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn(async () => {}) }, configurable: true });

// Every request must be handled by the fake API; an unexpected call fails the test.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  // Sonner keeps toasts in module state; without this they reappear in the next test.
  toast.dismiss();
  server.resetHandlers();
  resetFakeApi();
  resetGlobalStore();
  useBoardFilters.getState().reset();
  useUiStore.setState({ theme: "system", lastWorkspaceId: null });
  localStorage.clear();
});
afterAll(() => server.close());
