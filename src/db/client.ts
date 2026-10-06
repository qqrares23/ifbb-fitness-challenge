import Database from "@tauri-apps/plugin-sql";

// Must match DATABASE_URL in src-tauri/src/lib.rs, which registers the migrations for it.
const DATABASE_URL = "sqlite:fitness-challenge.db";

let connection: Promise<Database> | undefined;

/** The single app-wide connection; migrations run on first load. A failed load is retried next call. */
export function db(): Promise<Database> {
  connection ??= Database.load(DATABASE_URL).catch((error: unknown) => {
    connection = undefined;
    throw error;
  });
  return connection;
}

/** Closes the connection (e.g. before the database file is replaced); the next `db()` reopens it. */
export async function closeDb(): Promise<void> {
  const open = connection;
  connection = undefined;
  if (open) await (await open).close();
}
