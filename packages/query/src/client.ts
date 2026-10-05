import { Query, type QueryHost, type QueryOptions } from "./query";

const DEFAULTS: Required<QueryOptions> = {
  staleTime: 5_000,
  pollInterval: 0,
  refetchOnFocus: true,
  gcTime: 5 * 60_000,
};

/**
 * Registry of queries by key. Keys are arrays joined with "/", so invalidating
 * ["ws", id] also refreshes ["ws", id, "tasks"].
 */
export class QueryClient implements QueryHost {
  private queries = new Map<string, Query<unknown>>();
  private cleanupFocus: (() => void) | null = null;

  constructor(private defaults: QueryOptions = {}) {
    const doc = (globalThis as { document?: Document }).document;
    if (doc) {
      const onVisible = () => {
        if (doc.visibilityState === "visible") for (const q of this.queries.values()) q.onVisible();
      };
      doc.addEventListener("visibilitychange", onVisible);
      globalThis.addEventListener?.("focus", onVisible);
      this.cleanupFocus = () => {
        doc.removeEventListener("visibilitychange", onVisible);
        globalThis.removeEventListener?.("focus", onVisible);
      };
    }
  }

  static key(parts: readonly (string | number)[]) {
    return parts.join("/");
  }

  /** Get or create the query for a key. The first caller's fetcher and options win. */
  query<T>(parts: readonly (string | number)[], fetcher: () => Promise<T>, options: QueryOptions = {}): Query<T> {
    const key = QueryClient.key(parts);
    let q = this.queries.get(key) as Query<T> | undefined;
    if (!q) {
      q = new Query<T>(key, fetcher, { ...DEFAULTS, ...this.defaults, ...options }, this);
      this.queries.set(key, q as Query<unknown>);
    }
    return q;
  }

  peek<T>(parts: readonly (string | number)[]): Query<T> | undefined {
    return this.queries.get(QueryClient.key(parts)) as Query<T> | undefined;
  }

  invalidate(prefix: readonly (string | number)[]) {
    const p = QueryClient.key(prefix);
    for (const [key, q] of this.queries) {
      if (key === p || key.startsWith(`${p}/`)) q.invalidate();
    }
  }

  /**
   * Drop cached data, e.g. on sign-out so the next user never sees it. Queries listed in `keep`
   * survive because long-lived stores hold references to them.
   */
  clear(options: { keep?: readonly (readonly (string | number)[])[] } = {}) {
    const keep = new Set((options.keep ?? []).map((k) => QueryClient.key(k)));
    for (const [key, q] of this.queries) {
      if (keep.has(key)) continue;
      q.dispose();
      this.queries.delete(key);
    }
  }

  isVisible() {
    const doc = (globalThis as { document?: Document }).document;
    return !doc || doc.visibilityState !== "hidden";
  }

  onRemove(key: string) {
    const q = this.queries.get(key);
    if (q && !q.hasSubscribers) {
      q.dispose();
      this.queries.delete(key);
    }
  }

  destroy() {
    for (const q of this.queries.values()) q.dispose();
    this.queries.clear();
    this.cleanupFocus?.();
  }
}
