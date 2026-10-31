import type { CategoryFormat, CategoryGender, CategoryRules } from "@/engine";
import { parseWholeNumber } from "@/lib/numbers";

/** The sub-group form keeps ages as text so a field can be left empty (= no limit). */
export interface SubgroupFormValues {
  format: CategoryFormat;
  gender: CategoryGender;
  minAge: string;
  maxAge: string;
}

export type SubgroupFormErrors = Partial<Record<keyof SubgroupFormValues, string>>;

export type SubgroupValidation = { ok: true; value: CategoryRules } | { ok: false; errors: SubgroupFormErrors };

/** Matches the CHECKs on category ages in the migrations. */
export const MAX_AGE = 120;

function parseAge(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const age = parseWholeNumber(trimmed);
  return age !== undefined && age <= MAX_AGE ? age : undefined;
}

export function validateSubgroup(form: SubgroupFormValues): SubgroupValidation {
  const errors: SubgroupFormErrors = {};
  const minAge = parseAge(form.minAge);
  const maxAge = parseAge(form.maxAge);

  if (minAge === undefined) errors.minAge = `Enter a whole number from 0 to ${MAX_AGE}, or leave empty.`;
  if (maxAge === undefined) errors.maxAge = `Enter a whole number from 0 to ${MAX_AGE}, or leave empty.`;
  if (minAge != null && maxAge != null && minAge > maxAge) errors.maxAge = "Maximum age can't be below the minimum.";

  if (Object.keys(errors).length > 0 || minAge === undefined || maxAge === undefined) return { ok: false, errors };
  return { ok: true, value: { format: form.format, gender: form.gender, minAge, maxAge } };
}
