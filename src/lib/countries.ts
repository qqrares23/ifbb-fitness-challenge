import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json";

countries.registerLocale(en);

export interface Country {
  /** ISO 3166-1 alpha-3, e.g. "ROU". */
  code: string;
  name: string;
}

export const COUNTRIES: Country[] = Object.entries(countries.getNames("en", { select: "official" }))
  .map(([alpha2, name]) => ({ code: countries.alpha2ToAlpha3(alpha2)!, name }))
  .sort((a, b) => a.name.localeCompare(b.name, "en"));

const NAME_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c.name]));

export function countryName(code: string): string {
  return NAME_BY_CODE.get(code) ?? code;
}
