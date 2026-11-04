import type { Category } from "@/db/categories";
import type { CompetitionSetup } from "@/db/competitions";
import type { Entry, EntryMember } from "@/db/entries";
import { ageOn, assignPlaces } from "@/engine";
import { hasReps, type CompetitionResults } from "@/features/competitions/standings";
import { countryName } from "@/lib/countries";
import { entryClubs, entryCountries, entryFullName, listName, SEX_LABELS } from "@/lib/labels";

// Tables for the entry list and the placement by country / club. Countries are written out in
// full ("Romania", not "ROU"): these are printed for people, not matched by code.

export interface SimpleTable {
  head: string[];
  body: string[][];
}

/** Every athlete entered, by surname: Nr | Athlete | Sex | Age | Country | [Club] | Categories. */
export function athleteListTable(setup: CompetitionSetup): SimpleTable {
  const { competition, categories, entries } = setup;
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const athletes = new Map<number, { member: EntryMember; bib: number | null; categories: string[] }>();
  for (const entry of [...entries].sort((a, b) => a.bibNumber - b.bibNumber)) {
    for (const member of entry.members) {
      const athlete = athletes.get(member.athleteId) ?? { member, bib: null, categories: [] };
      if (!entry.team) athlete.bib = entry.bibNumber;
      const name = categoryName.get(entry.categoryId) ?? "";
      // A couple / team has its own number, so it is named next to that category.
      athlete.categories.push(entry.team ? `${name} (Nr ${entry.bibNumber})` : name);
      athletes.set(member.athleteId, athlete);
    }
  }
  const rows = [...athletes.values()].sort((a, b) => listName(a.member).localeCompare(listName(b.member)));
  const withClub = rows.some((a) => a.member.club.trim());
  return {
    head: ["Nr", "Athlete", "Sex", "Age", "Country", ...(withClub ? ["Club"] : []), "Categories"],
    body: rows.map(({ member, bib, categories }) => [
      bib === null ? "—" : String(bib),
      listName(member),
      SEX_LABELS[member.sex],
      String(ageOn(member.dateOfBirth, competition.date)),
      countryName(member.country),
      ...(withClub ? [member.club.trim()] : []),
      categories.join("\n"),
    ]),
  };
}

const NAME_HEADERS = { individual: "Athlete", couple: "Couple", team: "Team" } as const;

/** One category's entries in number order: Nr | Athlete (Couple / Team) | Country | [Club]. */
export function categoryEntriesTable(category: Category, entries: readonly Entry[]): SimpleTable {
  const own = entries.filter((e) => e.categoryId === category.id).sort((a, b) => a.bibNumber - b.bibNumber);
  const withClub = own.some((e) => entryClubs(e));
  return {
    head: ["Nr", NAME_HEADERS[category.format], "Country", ...(withClub ? ["Club"] : [])],
    body: own.map((e) => [String(e.bibNumber), entryFullName(e), entryCountries(e), ...(withClub ? [entryClubs(e)] : [])]),
  };
}

export type PlacementGrouping = "country" | "club";

export interface PlacementRow {
  place: number;
  name: string;
  gold: number;
  silver: number;
  bronze: number;
}

/**
 * Countries or clubs ranked by their 1st, then 2nd, then 3rd places across every category (a
 * medal table); equal counts share a place (1, 1, 3). A couple or team counts once for each of
 * its countries / clubs. Everyone who took part is listed, those without a podium place last.
 * Athletes without a club, and IFBB Fitness Challenge categories (whose results show no clubs), aren't counted for clubs.
 */
export function placementTable(results: CompetitionResults, by: PlacementGrouping): PlacementRow[] {
  // IFBB Fitness Challenge results never show clubs (see standingsTable), so those categories don't count for clubs.
  const groupsOf = (entry: Entry, noClubs: boolean) =>
    new Set(entry.members.map((m) => (by === "country" ? countryName(m.country) : noClubs ? "" : m.club.trim())).filter(Boolean));
  const placed: { entry: Entry; place: number | null; noClubs: boolean }[] = results.categories.flatMap((c) =>
    c.kind === "speed_fit"
      ? c.rows.map((row) => ({ ...row, noClubs: false }))
      : c.rows.map((row) => ({ entry: row.entry, place: hasReps(row) ? row.place : null, noClubs: c.category.federation === "ifbb" })),
  );

  const tally = new Map<string, PlacementRow>();
  for (const { entry, place, noClubs } of placed) {
    for (const name of groupsOf(entry, noClubs)) {
      const row = tally.get(name) ?? { place: 0, name, gold: 0, silver: 0, bronze: 0 };
      if (place === 1) row.gold++;
      else if (place === 2) row.silver++;
      else if (place === 3) row.bronze++;
      tally.set(name, row);
    }
  }

  const byMedals = (a: PlacementRow, b: PlacementRow) => b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze;
  const rows = [...tally.values()].sort((a, b) => byMedals(a, b) || a.name.localeCompare(b.name));
  assignPlaces(rows, byMedals).forEach((place, i) => (rows[i]!.place = place));
  return rows;
}
