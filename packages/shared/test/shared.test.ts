import { describe, expect, it } from "vitest";
import { createTaskSchema, positionBetween, taskChangesSchema, updateTaskSchema } from "../src";

describe("positionBetween", () => {
  it("sorts new keys between their neighbours", () => {
    const a = positionBetween(null, null);
    const c = positionBetween(a, null);
    const b = positionBetween(a, c);
    expect([c, b, a].sort()).toEqual([a, b, c]);
  });

  it("can insert many times in the same gap", () => {
    let lo = positionBetween(null, null);
    const hi = positionBetween(lo, null);
    for (let i = 0; i < 50; i++) {
      const mid = positionBetween(lo, hi);
      expect(lo < mid && mid < hi).toBe(true);
      lo = mid;
    }
  });

  it("tolerates neighbours in the wrong order", () => {
    const a = positionBetween(null, null);
    const b = positionBetween(a, null);
    expect(positionBetween(b, a) > b).toBe(true);
  });
});

describe("task schemas", () => {
  it("requires a title to create", () => {
    expect(createTaskSchema.safeParse({}).success).toBe(false);
    expect(createTaskSchema.safeParse({ title: "Ok" }).success).toBe(true);
  });

  it("rejects an end date before the start date", () => {
    const r = taskChangesSchema.safeParse({ startDate: "2026-10-10", endDate: "2026-10-01" });
    expect(r.success).toBe(false);
  });

  it("rejects an empty change set", () => {
    expect(updateTaskSchema.safeParse({ baseVersion: 1, changes: {} }).success).toBe(false);
  });

  it("requires at least one owner", () => {
    expect(taskChangesSchema.safeParse({ ownerIds: [] }).success).toBe(false);
  });
});
