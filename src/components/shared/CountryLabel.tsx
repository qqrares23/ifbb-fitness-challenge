import { countryName } from "@/lib/countries";

/** "Romania ROU": the country's name, with its code in small print. */
export function CountryLabel({ code }: { code: string }) {
  return (
    <>
      {countryName(code)} <span className="text-xs text-muted-foreground">{code}</span>
    </>
  );
}
