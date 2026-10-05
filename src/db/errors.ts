import { errorMessage } from "@/lib/errors";

interface ConstraintMessages {
  unique?: string;
  foreignKey?: string;
}

/** Re-throws SQLite constraint violations as user-facing messages; anything else passes through. */
export async function withConstraintMessages<T>(work: Promise<T>, messages: ConstraintMessages): Promise<T> {
  try {
    return await work;
  } catch (error) {
    const message = errorMessage(error);
    if (messages.unique && message.includes("UNIQUE constraint failed")) throw new Error(messages.unique);
    if (messages.foreignKey && message.includes("FOREIGN KEY constraint failed")) throw new Error(messages.foreignKey);
    throw error;
  }
}
