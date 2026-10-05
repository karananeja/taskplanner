import type { TaskFields } from "@tp/shared";
import { describe, expect, it } from "vitest";
import { diffFields, permissionsFor } from "../../src/services/tasks";

const base: TaskFields = {
  title: "T", description: "", status: "TODO", priority: "NONE", clientId: null,
  startDate: null, endDate: null, dueDate: null, assigneeIds: ["a", "b"], ownerIds: ["o"], labelIds: [],
};

describe("diffFields", () => {
  it("returns only fields that actually change", () => {
    expect(diffFields(base, { title: "T", priority: "HIGH" })).toEqual([{ field: "priority", from: "NONE", to: "HIGH" }]);
  });

  it("compares people and labels as sets, ignoring order", () => {
    expect(diffFields(base, { assigneeIds: ["b", "a"] })).toEqual([]);
    expect(diffFields(base, { assigneeIds: ["a"] })).toHaveLength(1);
  });

  it("treats clearing a date as a change", () => {
    expect(diffFields({ ...base, dueDate: "2026-10-01" }, { dueDate: null })).toEqual([{ field: "dueDate", from: "2026-10-01", to: null }]);
  });
});

describe("permissionsFor", () => {
  const task = { owners: [{ userId: "o" }], assignees: [{ userId: "a" }] };

  it.each([
    ["task owner", { userId: "o", role: "MEMBER" }, { isOwner: true, isAssignee: false, canDelete: true, canWorkOn: true }],
    ["workspace owner", { userId: "w", role: "OWNER" }, { isOwner: true, isAssignee: false, canDelete: true, canWorkOn: true }],
    ["assignee", { userId: "a", role: "MEMBER" }, { isOwner: false, isAssignee: true, canDelete: false, canWorkOn: true }],
    ["other member", { userId: "x", role: "MEMBER" }, { isOwner: false, isAssignee: false, canDelete: false, canWorkOn: false }],
  ] as const)("%s", (_label, actor, expected) => {
    expect(permissionsFor(task, actor)).toEqual(expected);
  });
});
