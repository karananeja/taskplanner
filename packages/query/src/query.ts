export type QueryStatus = "idle" | "loading" | "success" | "error";

export interface QueryState<T> {
  data: T | undefined;
  error: unknown;
  status: QueryStatus;
  /** True whenever a request is in flight, including background refreshes. */
  isFetching: boolean;
  updatedAt: number;
}

export interface QueryOptions {
  /** Data younger than this is served from cache without refetching on subscribe. */
  staleTime?: number;
  /** Refetch on this interval while subscribed and the page is visible. */
  pollInterval?: number;
  /** Refetch when the page becomes visible again. Defaults to true. */
  refetchOnFocus?: boolean;
  /** Keep unsubscribed data around for this long before dropping it. */
  gcTime?: number;
}

type Listener = () => void;

export interface QueryHost {
  isVisible(): boolean;
  onRemove(key: string): void;
}

/**
 * One cached server resource. Framework-agnostic: React reads it via `useQuery`,
 * stores write to it via `setData` for optimistic updates.
 */
export class Query<T> {
  private state: QueryState<T> = { data: undefined, error: undefined, status: "idle", isFetching: false, updatedAt: 0 };
  private listeners = new Set<Listener>();
  private inflight: Promise<T> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private gcTimer: ReturnType<typeof setTimeout> | null = null;
  /** Bumped by every local write so a slower in-flight fetch can't overwrite an optimistic update. */
  private writeSeq = 0;

  constructor(
    readonly key: string,
    private fetcher: () => Promise<T>,
    readonly options: Required<QueryOptions>,
    private host: QueryHost,
  ) {}

  getSnapshot = (): QueryState<T> => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    if (this.gcTimer) clearTimeout(this.gcTimer);
    this.gcTimer = null;
    if (this.listeners.size === 1) {
      if (this.isStale()) void this.fetch().catch(() => {});
      this.startPolling();
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.stopPolling();
        this.gcTimer = setTimeout(() => this.host.onRemove(this.key), this.options.gcTime);
      }
    };
  };

  get hasSubscribers() {
    return this.listeners.size > 0;
  }

  isStale() {
    return this.state.status !== "success" || Date.now() - this.state.updatedAt > this.options.staleTime;
  }

  /** Fetch now, de-duplicating concurrent calls. */
  fetch(): Promise<T> {
    if (this.inflight) return this.inflight;
    const seq = this.writeSeq;
    this.set({ isFetching: true, status: this.state.status === "success" ? "success" : "loading" });
    const run = this.fetcher()
      .then((data) => {
        // A local write happened while this request was in flight; its data is newer than ours.
        if (seq === this.writeSeq) this.set({ data, error: undefined, status: "success", isFetching: false, updatedAt: Date.now() });
        else this.set({ isFetching: false });
        return data;
      })
      .catch((error: unknown) => {
        // Keep showing the last good data if a background refresh fails.
        this.set({ error, isFetching: false, status: this.state.data === undefined ? "error" : "success" });
        throw error;
      })
      .finally(() => {
        this.inflight = null;
      });
    this.inflight = run;
    return run;
  }

  /** Always gets fresh data, even if a request is already running. */
  async refetch(): Promise<T | undefined> {
    if (this.inflight) await this.inflight.catch(() => {});
    return this.fetch().catch(() => undefined);
  }

  /** Mark stale and refetch if anyone is watching. */
  invalidate() {
    this.state = { ...this.state, updatedAt: 0 };
    if (this.hasSubscribers) void this.refetch();
  }

  /** Write data locally (optimistic updates, or a mutation's response). */
  setData(updater: T | ((prev: T | undefined) => T)) {
    this.writeSeq++;
    const data = typeof updater === "function" ? (updater as (prev: T | undefined) => T)(this.state.data) : updater;
    this.set({ data, status: "success", error: undefined, updatedAt: Date.now() });
  }

  onVisible() {
    if (this.hasSubscribers && this.options.refetchOnFocus && this.isStale()) void this.refetch();
  }

  dispose() {
    this.stopPolling();
    if (this.gcTimer) clearTimeout(this.gcTimer);
    this.listeners.clear();
  }

  private startPolling() {
    if (!this.options.pollInterval || this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      if (this.host.isVisible() && !this.inflight) void this.fetch().catch(() => {});
    }, this.options.pollInterval);
  }

  private stopPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  private set(patch: Partial<QueryState<T>>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }
}
