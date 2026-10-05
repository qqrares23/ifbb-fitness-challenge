import type { IsoDate } from "./types";

function parseIsoDate(value: IsoDate): [year: number, month: number, day: number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid date "${value}", expected YYYY-MM-DD.`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Completed years of age on `onDate`. Works on calendar components only, so the result
 * never depends on the machine's time zone. A 29 February birthday turns over on 1 March.
 */
export function ageOn(dateOfBirth: IsoDate, onDate: IsoDate): number {
  const [by, bm, bd] = parseIsoDate(dateOfBirth);
  const [y, m, d] = parseIsoDate(onDate);
  const birthdayReached = m > bm || (m === bm && d >= bd);
  return y - by - (birthdayReached ? 0 : 1);
}
