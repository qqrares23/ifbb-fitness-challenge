import type { IsoDate } from "./types";

function yearOf(value: IsoDate): number {
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(value);
  if (!match) throw new Error(`Invalid date "${value}", expected YYYY-MM-DD.`);
  return Number(match[1]);
}

/**
 * Age as IFBB categories count it: the year of `onDate` minus the year of birth. Month and day
 * are ignored, so an athlete keeps the same age (and category) for the whole calendar year.
 */
export function ageOn(dateOfBirth: IsoDate, onDate: IsoDate): number {
  return yearOf(onDate) - yearOf(dateOfBirth);
}
