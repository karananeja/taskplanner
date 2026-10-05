import { describe, expect, it } from "vitest";
import { splitIntoDrafts } from "./split-lines";

const members = [
  { id: "u_jay", name: "Jay" },
  { id: "u_js", name: "Jay Shrivastava" },
  { id: "u_c", name: "Chirag Kumar" },
];

describe("splitIntoDrafts", () => {
  it("makes one draft per line and strips bullets, numbers and checkboxes", () => {
    const text = "- Follow up with design\n* Send contract\n1. Book venue\n2) Call vendor\n- [ ] Draft agenda\n[x] Ship it\n• Review";
    expect(splitIntoDrafts(text, []).map((d) => d.title)).toEqual([
      "Follow up with design",
      "Send contract",
      "Book venue",
      "Call vendor",
      "Draft agenda",
      "Ship it",
      "Review",
    ]);
  });

  it("skips blank lines and headings, and drops TODO prefixes", () => {
    const text = "Action items:\n\n  TODO: fix the login bug\nAI - update the roadmap\n";
    expect(splitIntoDrafts(text, []).map((d) => d.title)).toEqual(["fix the login bug", "update the roadmap"]);
  });

  it("assigns @mentioned members, preferring the longest matching name", () => {
    const [a, b] = splitIntoDrafts("- Send mockups @Jay Shrivastava\n- @chirag kumar and @Jay review copy", members);
    expect(a).toEqual({ title: "Send mockups", assigneeIds: ["u_js"] });
    expect(b?.assigneeIds.sort()).toEqual(["u_c", "u_jay"]);
    expect(b?.title).toBe("and review copy");
  });
});
