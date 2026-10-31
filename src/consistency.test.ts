/// <reference types="node" />
// Values that must match across Rust, SQL and TypeScript but can't share one definition.
// If one of these fails, update the other side too.
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAX_REPS } from "@/db/scores";
import { MAX_TIME_MS, type CategoryFormat, type CategoryGender } from "@/engine";
import { MAX_AGE } from "@/features/categories/validateSubgroup";
import { categoryName } from "@/lib/labels";

const read = (path: string) => readFileSync(path, "utf8");
const allMigrations = readdirSync("src-tauri/migrations")
  .sort()
  .map((file) => read(`src-tauri/migrations/${file}`))
  .join("\n");

describe("cross-language constants", () => {
  it("opens the database the Rust side registers the migrations for", () => {
    const rust = /const DATABASE_URL: &str = "([^"]+)"/.exec(read("src-tauri/src/lib.rs"))?.[1];
    const ts = /const DATABASE_URL = "([^"]+)"/.exec(read("src/db/client.ts"))?.[1];
    expect(ts).toBeDefined();
    expect(rust).toBe(ts);
  });

  it("registers every migration file in lib.rs, in order", () => {
    const files = readdirSync("src-tauri/migrations").sort();
    const registered = [...read("src-tauri/src/lib.rs").matchAll(/migrations\/(\d{4}_\w+\.sql)/g)].map((m) => m[1]);
    expect(registered).toEqual(files);
  });

  it("keeps the Cargo version equal to package.json (tauri.conf.json reads package.json)", () => {
    const pkg = JSON.parse(read("package.json")).version;
    expect(/^version = "([^"]+)"/m.exec(read("src-tauri/Cargo.toml"))?.[1]).toBe(pkg);
    expect(JSON.parse(read("src-tauri/tauri.conf.json")).version).toBe("../package.json");
  });

  it("validates reps, times and ages with the same limits as the SQL CHECKs", () => {
    expect(allMigrations).toContain(`reps BETWEEN 0 AND ${MAX_REPS}`);
    const timeLimit = Number(/time_ms < (\d+)/.exec(allMigrations)?.[1]);
    expect(MAX_TIME_MS).toBeLessThan(timeLimit);
    expect(MAX_TIME_MS).toBeGreaterThan(timeLimit - 100);
    expect(allMigrations).toContain(`BETWEEN 0 AND ${MAX_AGE}`);
    expect(read("src-tauri/judge/index.html")).toContain(`const MAX_REPS = ${MAX_REPS};`);
  });

  it("names categories the same on the judging page as in the app", () => {
    const page = read("src-tauri/judge/index.html");
    const port = page.slice(page.indexOf("--- Category names"), page.indexOf("// --- End of the port"));
    const onPage = new Function(`//${port}; return categoryName;`)() as typeof categoryName;
    const rules = (format: CategoryFormat, gender: CategoryGender, minAge: number | null, maxAge: number | null) => ({ format, gender, minAge, maxAge });
    const samples: Parameters<typeof categoryName>[] = [
      ["Junior", rules("individual", "male", 14, 23), "Gold"],
      ["Masters", rules("individual", "female", 40, null), "Bronze"],
      ["Open", rules("individual", "male", null, null), ""],
      ["Youth", rules("individual", "mixed", null, 12), ""],
      ["Kids", rules("team", "female", 10, 10), "Level 2"],
      ["Juniors Men 16-20", rules("individual", "male", 16, 20), "Gold"],
      ["Junior Gold", rules("individual", "male", 14, 23), "Gold"],
      ["Senior", rules("couple", "mixed", 18, null), "Gold"],
      ["Couples", rules("couple", "mixed", 18, null), ""],
      ["Teams", rules("team", "male", null, null), ""],
    ];
    for (const sample of samples) expect(onPage(...sample)).toBe(categoryName(...sample));
  });
});
