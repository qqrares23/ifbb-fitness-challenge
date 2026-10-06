import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/shared/FormField";
import type { CategoryGender, CategoryRules } from "@/engine";
import { CATEGORY_GENDER_LABELS } from "@/lib/labels";
import type { SubgroupFormErrors, SubgroupFormValues } from "./validateSubgroup";

/** Form values for a set of category rules; empty age fields mean "no limit". */
export function rulesToForm(rules: CategoryRules | null): SubgroupFormValues {
  return {
    gender: rules?.gender ?? "male",
    minAge: rules?.minAge?.toString() ?? "",
    maxAge: rules?.maxAge?.toString() ?? "",
  };
}

interface AgeRulesFieldsProps {
  values: SubgroupFormValues;
  errors: SubgroupFormErrors;
  set: <K extends keyof SubgroupFormValues>(key: K, value: SubgroupFormValues[K]) => void;
}

/** Sex + inclusive age limits: used by library sub-groups and by a competition's categories. */
export function AgeRulesFields({ values, errors, set }: AgeRulesFieldsProps) {
  return (
    <>
      <FormField id="rules-gender" label="Sex">
        <Select value={values.gender} onValueChange={(gender) => set("gender", gender as CategoryGender)}>
          <SelectTrigger id="rules-gender" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CATEGORY_GENDER_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField id="rules-min-age" label="Minimum age" error={errors.minAge}>
          <Input id="rules-min-age" inputMode="numeric" value={values.minAge} onChange={(e) => set("minAge", e.target.value)} placeholder="No limit" autoFocus />
        </FormField>
        <FormField id="rules-max-age" label="Maximum age" error={errors.maxAge}>
          <Input id="rules-max-age" inputMode="numeric" value={values.maxAge} onChange={(e) => set("maxAge", e.target.value)} placeholder="No limit" />
        </FormField>
      </div>
      <p className="text-xs text-muted-foreground">Both limits are inclusive. Age = the competition's year minus the year of birth.</p>
    </>
  );
}
