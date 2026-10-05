import type { CategoryInput } from "@/db/categories";
import type { CategoryGender } from "@/engine";

/** The category form keeps ages as text so a field can be left empty (= no limit). */
export interface CategoryFormValues {
  name: string;
  gender: CategoryGender;
  minAge: string;
  maxAge: string;
}

export type CategoryFormErrors = Partial<Record<keyof CategoryFormValues, string>>;

export type CategoryValidation = { ok: true; value: CategoryInput } | { ok: false; errors: CategoryFormErrors };

function parseAge(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const age = Number(trimmed);
  return Number.isInteger(age) && age >= 0 && age <= 120 ? age : undefined;
}

export function validateCategory(form: CategoryFormValues): CategoryValidation {
  const errors: CategoryFormErrors = {};
  const minAge = parseAge(form.minAge);
  const maxAge = parseAge(form.maxAge);

  if (!form.name.trim()) errors.name = "Name is required.";
  if (minAge === undefined) errors.minAge = "Enter a whole number from 0 to 120, or leave empty.";
  if (maxAge === undefined) errors.maxAge = "Enter a whole number from 0 to 120, or leave empty.";
  if (minAge != null && maxAge != null && minAge > maxAge) errors.maxAge = "Maximum age can't be below the minimum.";

  if (Object.keys(errors).length > 0 || minAge === undefined || maxAge === undefined) return { ok: false, errors };
  return { ok: true, value: { name: form.name.trim(), gender: form.gender, minAge, maxAge } };
}
