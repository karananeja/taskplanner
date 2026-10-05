import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDay, formatRange, parseDateOnly, timeAgo, todayISO } from "./dates";

afterEach(() => vi.useRealTimers());

describe("dates", () => {
  it("parses YYYY-MM-DD as a local calendar day, not UTC midnight", () => {
    const d = parseDateOnly("2026-10-01");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 1]);
  });

  it("formats ranges with whatever ends are set", () => {
    expect(formatRange("2026-09-27", "2026-10-04")).toBe(`${formatDay("2026-09-27")} – ${formatDay("2026-10-04")}`);
    expect(formatRange("2026-09-27", null)).toMatch(/^From /);
    expect(formatRange(null, "2026-10-04")).toMatch(/^Until /);
    expect(formatRange(null, null)).toBeNull();
  });

  it("gives today's date in local time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 23, 30));
    expect(todayISO()).toBe("2026-01-05");
  });

  it("describes recent times relatively", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
    expect(timeAgo("2026-09-30T11:59:50Z")).toBe("just now");
    expect(timeAgo("2026-09-30T11:55:00Z")).toBe("5 minutes ago");
    expect(timeAgo("2026-09-29T12:00:00Z")).toBe("yesterday");
  });
});
