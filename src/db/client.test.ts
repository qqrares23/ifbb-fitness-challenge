import { expect, it, vi } from "vitest";
import Database from "@tauri-apps/plugin-sql";
import { db, replaceDatabaseFile } from "./client";

const close = vi.fn(async () => true);
vi.mock("@tauri-apps/plugin-sql", () => ({ default: { load: vi.fn() } }));

it("makes queries wait while the database file is replaced, and reopens it if that fails", async () => {
  const load = vi.mocked(Database.load).mockResolvedValue({ select: async () => [], close } as unknown as Database);
  await db();
  expect(load).toHaveBeenCalledTimes(1);

  let failSwap = (_: Error) => {};
  const swap = new Promise<void>((_, reject) => (failSwap = reject));
  const replaced = replaceDatabaseFile(() => swap);
  const poll = db(); // e.g. the results poll, during the swap
  await vi.waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  expect(load).toHaveBeenCalledTimes(1);

  failSwap(new Error("not a database"));
  await expect(replaced).rejects.toThrow("not a database");
  await poll;
  expect(load).toHaveBeenCalledTimes(2);
});
