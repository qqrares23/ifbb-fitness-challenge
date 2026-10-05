import type { IsoDate } from "@/engine";

/** Today's date on this computer, as "YYYY-MM-DD". */
export function todayIso(): IsoDate {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "2000-06-15" → "15 Jun 2000". Formatted in UTC so the calendar day never shifts. */
export function formatDate(value: IsoDate): string {
  return DATE_FORMAT.format(new Date(`${value}T00:00:00Z`));
}
