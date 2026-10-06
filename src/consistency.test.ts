/// <reference types="node" />
// Values that must match across Rust, SQL and TypeScript but can't share one definition.
// If one of these fails, update the other side too.
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAX_REPS } from "@/db/scores";
import { MAX_TIME_MS } from "@/engine";
import { MAX_AGE } from "@/features/categories/validateSubgroup";

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
  });
});
