import Database from "@tauri-apps/plugin-sql";

// Must match DATABASE_URL in src-tauri/src/lib.rs, which registers the migrations for it.
const DATABASE_URL = "sqlite:fitness-challenge.db";

let connection: Promise<Database> | undefined;

/** Settles when no database file swap is under way; never rejects. */
let replacing: Promise<unknown> = Promise.resolve();

/** The single app-wide connection; migrations run on first load. A failed load is retried next call. */
export function db(): Promise<Database> {
  connection ??= replacing
    .then(() => Database.load(DATABASE_URL))
    .then(async (conn) => {
      // Write-ahead log: a save is one append instead of a journal file per commit, and reads
      // (e.g. refreshing results) never wait for a write. Stored in the file, so it covers every
      // pooled connection. Can't go in a migration: SQLite refuses it inside a transaction.
      await conn.select("PRAGMA journal_mode = WAL");
      return conn;
    })
    .catch((error: unknown) => {
      connection = undefined;
      throw error;
    });
  return connection;
}

/**
 * Closes the connection, runs `swap` (which replaces the database file) and reloads the app.
 * Queries meanwhile, like the results poll, wait instead of reopening the file mid-swap. If `swap`
 * fails nothing changed: the promise rejects and those queries go on with the same file.
 */
export function replaceDatabaseFile(swap: () => Promise<void>): Promise<void> {
  const open = connection;
  connection = undefined;
  const done = replacing.then(async () => {
    if (open) await (await open).close();
    await swap();
    window.location.reload();
    await new Promise(() => {}); // stays closed until the page is gone
  });
  replacing = done.catch(() => undefined);
  return done;
}
