import { LIMITS } from "@tp/shared";

export interface DraftLine {
  title: string;
  /** Member ids picked up from "@Name" in the line. */
  assigneeIds: string[];
}

const BULLET = /^\s*(?:[-*•–·]|\d+[.)]|\[[ xX]?\])\s*(?:\[[ xX]?\]\s*)?/;
const PREFIX = /^(?:todo|action(?: item)?|ai|task)\s*[:\-–]\s*/i;

/**
 * Turn pasted notes into draft task titles: one per line, bullets and "TODO:" prefixes stripped,
 * blank lines and section headings ("Action items:") skipped, and "@Name" matched to members.
 */
export function splitIntoDrafts(text: string, members: { id: string; name: string }[]): DraftLine[] {
  // Longest names first, so "@Jay Shrivastava" wins over a member called "Jay".
  const byName = [...members].sort((a, b) => b.name.length - a.name.length);
  const drafts: DraftLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.replace(BULLET, "").trim().replace(PREFIX, "").trim();
    if (!line || (line.endsWith(":") && !BULLET.test(raw))) continue;
    const assigneeIds: string[] = [];
    for (const m of byName) {
      const tag = `@${m.name}`;
      const at = line.toLowerCase().indexOf(tag.toLowerCase());
      if (at === -1) continue;
      assigneeIds.push(m.id);
      line = (line.slice(0, at) + line.slice(at + tag.length)).replace(/\s{2,}/g, " ").trim();
    }
    line = line.replace(/[\s,;–-]+$/, "").trim();
    if (line) drafts.push({ title: line.slice(0, LIMITS.title), assigneeIds });
  }
  return drafts;
}
