import { AuthStore, DocStore, InboxStore, TaskStore, WorkspaceStore } from "@tp/data-stores";
import { QueryClient } from "@tp/query";
import { createHttp } from "@/lib/http";

/**
 * Composition root: one query cache and one instance of each domain store for the whole app.
 * Screens reach these through the hooks in src/hooks, never by constructing stores themselves.
 */
class GlobalStore {
  readonly queries = new QueryClient();
  readonly http = createHttp(() => this.auth.handleUnauthorized());
  readonly auth = new AuthStore(this.http, this.queries);
  readonly workspaces = new WorkspaceStore(this.http, this.queries, this.auth);
  readonly tasks = new TaskStore(this.http, this.queries);
  readonly inbox = new InboxStore(this.http, this.queries);
  readonly docs = new DocStore(this.http, this.queries);

  destroy() {
    this.queries.destroy();
  }
}

// `let` so tests can swap in a fresh instance; importers see the new one through the live binding.
export let globalStore = new GlobalStore();

/** Test-only: drop all cached server data and start from a clean composition root. */
export function resetGlobalStore() {
  globalStore.destroy();
  globalStore = new GlobalStore();
}

export type { GlobalStore };
