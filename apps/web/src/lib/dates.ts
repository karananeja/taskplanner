const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const full = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const withTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Parse a YYYY-MM-DD string as a local calendar date (not UTC midnight). */
export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const formatDay = (value: string) => dayMonth.format(parseDateOnly(value));
export const formatDate = (value: string) => full.format(parseDateOnly(value));
export const formatDateTime = (iso: string) => withTime.format(new Date(iso));
export const formatShortCreated = (iso: string) => dayMonth.format(new Date(iso));

export function formatRange(start: string | null, end: string | null): string | null {
  if (start && end) return `${formatDay(start)} – ${formatDay(end)}`;
  if (start) return `From ${formatDay(start)}`;
  if (end) return `Until ${formatDay(end)}`;
  return null;
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
export function timeAgo(iso: string): string {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return "just now";
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 604_800) return rtf.format(Math.round(seconds / 86_400), "day");
  return formatShortCreated(iso);
}
