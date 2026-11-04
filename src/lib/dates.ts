import type { IsoDate } from "@/engine";

/** Today's date on this computer, as "YYYY-MM-DD". */
export function todayIso(): IsoDate {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** "2000-06-15" → "15/06/2000" (day/month/year). Read from the text, so the calendar day never shifts. */
export function formatDate(value: IsoDate): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

/** "15/06/2000", or "15/06/2000 – 17/06/2000" when the last day differs from the first. */
export function formatDateRange(first: IsoDate, last: IsoDate | null): string {
  return last && last !== first ? `${formatDate(first)} – ${formatDate(last)}` : formatDate(first);
}
