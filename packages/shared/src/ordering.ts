import { generateKeyBetween } from "fractional-indexing";

/**
 * Position key between two neighbours. Tolerates stale or out-of-order input
 * (e.g. when a filtered board hides tasks) by falling back to "after `before`".
 */
export function positionBetween(before: string | null, after: string | null): string {
  if (before !== null && after !== null && before >= after) {
    return generateKeyBetween(before, null);
  }
  return generateKeyBetween(before, after);
}
