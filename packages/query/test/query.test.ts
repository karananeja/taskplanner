import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "../src/client";

afterEach(() => vi.useRealTimers());

describe("Query", () => {
  it("fetches on first subscribe and de-duplicates concurrent fetches", async () => {
    const client = new QueryClient();
    const fetcher = vi.fn(async () => 42);
    const q = client.query(["n"], fetcher);
    const unsub = q.subscribe(() => {});
    await Promise.all([q.fetch(), q.fetch()]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(q.getSnapshot()).toMatchObject({ data: 42, status: "success" });
    unsub();
  });

  it("does not let a slower in-flight fetch overwrite an optimistic write", async () => {
    const client = new QueryClient();
    let resolve!: (v: number) => void;
    const q = client.query(["n"], () => new Promise<number>((r) => (resolve = r)));
    const pending = q.fetch();
    q.setData(7);
    resolve(1);
    await pending;
    expect(q.getSnapshot().data).toBe(7);
  });

  it("keeps last good data when a background refresh fails", async () => {
    const client = new QueryClient();
    let fail = false;
    const q = client.query(["n"], async () => {
      if (fail) throw new Error("offline");
      return 1;
    });
    await q.fetch();
    fail = true;
    await q.fetch().catch(() => {});
    expect(q.getSnapshot()).toMatchObject({ data: 1, status: "success" });
  });

  it("polls while subscribed and stops after unsubscribe", async () => {
    vi.useFakeTimers();
    const client = new QueryClient();
    const fetcher = vi.fn(async () => 1);
    const q = client.query(["p"], fetcher, { pollInterval: 1000 });
    const unsub = q.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(3100);
    expect(fetcher).toHaveBeenCalledTimes(4); // initial + 3 polls
    unsub();
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("invalidates by key prefix", async () => {
    const client = new QueryClient();
    const a = vi.fn(async () => "a");
    const b = vi.fn(async () => "b");
    const qa = client.query(["ws", "1", "tasks"], a);
    const qb = client.query(["ws", "2", "tasks"], b);
    const ua = qa.subscribe(() => {});
    const ub = qb.subscribe(() => {});
    await Promise.resolve();
    client.invalidate(["ws", "1"]);
    await vi.waitFor(() => expect(a).toHaveBeenCalledTimes(2));
    expect(b).toHaveBeenCalledTimes(1);
    ua();
    ub();
  });
});
