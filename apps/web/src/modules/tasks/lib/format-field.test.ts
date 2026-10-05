import { describe, expect, it } from "vitest";
import { labels, makeWorkspace } from "@/test/fixtures";
import { type FieldLookups, formatFieldValue } from "./format-field";

const lookups: FieldLookups = {
  members: new Map(makeWorkspace().members.map((m) => [m.id, m])),
  labels: new Map(labels.map((l) => [l.id, l])),
  clients: new Map([["c1", { id: "c1", name: "Northwind", email: null, phone: null, color: "#000000", taskCount: 0, docCount: 0 }]]),
};

describe("formatFieldValue", () => {
  it.each([
    ["status", "IN_PROGRESS", "In progress"],
    ["priority", "HIGH", "High"],
    ["clientId", "c1", "Northwind"],
    ["clientId", null, "No client"],
    ["clientId", "gone", "Removed client"],
    ["assigneeIds", ["u_karan", "u_jay"], "Karan Aneja, Jay Shrivastava"],
    ["assigneeIds", [], "Nobody"],
    ["ownerIds", ["u_left"], "Former member"],
    ["labelIds", ["l_bug"], "Bug"],
    ["dueDate", null, "None"],
  ] as const)("%s %j → %s", (field, value, expected) => {
    expect(formatFieldValue(field, value, lookups)).toBe(expected);
  });

  it("shortens long descriptions", () => {
    expect(formatFieldValue("description", "x".repeat(200), lookups)).toHaveLength(81);
  });
});
