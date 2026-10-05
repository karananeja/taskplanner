import type { z } from "zod";
import { badRequest } from "./errors";

/** Parse a request body with a Zod schema, turning issues into a field → message map. */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_";
    fields[key] ??= issue.message;
  }
  const first = Object.values(fields)[0] ?? "Check the highlighted fields.";
  throw badRequest(first, fields);
}
