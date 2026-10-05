// sqlx wraps every SQLite error as "error returned from database: (code: N) <message>"; the
// message alone is what the user should see (trigger RAISE messages are written for them).
const SQLX_PREFIX = /^error returned from database: \(code: \d+\) /;

/** Tauri plugin errors arrive as plain strings, everything else as Error. */
export function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Unexpected error.";
  return message.replace(SQLX_PREFIX, "");
}
