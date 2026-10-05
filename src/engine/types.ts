// Shared vocabulary of the engine. Pure types — no database or UI imports anywhere in src/engine/.

export type Sex = "male" | "female";
export type CategoryGender = Sex | "mixed";

/** ISO calendar date, "YYYY-MM-DD". */
export type IsoDate = string;

export interface CategoryRules {
  gender: CategoryGender;
  /** Inclusive; null = no lower bound. */
  minAge: number | null;
  /** Inclusive; null = no upper bound. */
  maxAge: number | null;
}

export interface AthleteProfile {
  sex: Sex;
  dateOfBirth: IsoDate;
}

export interface RepScore {
  entryId: number;
  stationNumber: number;
  reps: number;
}

export interface RankedRow<T> {
  entry: T;
  /** Sum of every recorded station result; a missing station counts as 0. */
  totalReps: number;
  /** stationNumber → reps, or null where nothing is recorded yet. */
  perStation: Map<number, number | null>;
  /** True once every station has a recorded result. */
  complete: boolean;
  /** Competition ranking: equal totals share a place and the next place is skipped (1, 1, 3). */
  place: number;
}
