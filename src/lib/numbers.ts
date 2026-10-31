/** A whole number typed by a user, or undefined. Digits only: Number() also reads "1e3" and "0x10". */
export function parseWholeNumber(text: string): number | undefined {
  const trimmed = text.trim();
  const value = Number(trimmed);
  return /^\d+$/.test(trimmed) && Number.isSafeInteger(value) ? value : undefined;
}
