import type { CategoryGender, CategoryRules } from "@/engine";

/** The sub-group form keeps ages as text so a field can be left empty (= no limit). */
export interface SubgroupFormValues {
  gender: CategoryGender;
  minAge: string;
  maxAge: string;
}

export type SubgroupFormErrors = Partial<Record<keyof SubgroupFormValues, string>>;

export type SubgroupValidation = { ok: true; value: CategoryRules } | { ok: false; errors: SubgroupFormErrors };

function parseAge(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const age = Number(trimmed);
  return Number.isInteger(age) && age >= 0 && age <= 120 ? age : undefined;
}

export function validateSubgroup(form: SubgroupFormValues): SubgroupValidation {
  const errors: SubgroupFormErrors = {};
  const minAge = parseAge(form.minAge);
  const maxAge = parseAge(form.maxAge);

  if (minAge === undefined) errors.minAge = "Enter a whole number from 0 to 120, or leave empty.";
  if (maxAge === undefined) errors.maxAge = "Enter a whole number from 0 to 120, or leave empty.";
  if (minAge != null && maxAge != null && minAge > maxAge) errors.maxAge = "Maximum age can't be below the minimum.";

  if (Object.keys(errors).length > 0 || minAge === undefined || maxAge === undefined) return { ok: false, errors };
  return { ok: true, value: { gender: form.gender, minAge, maxAge } };
}
