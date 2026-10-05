/** Case-insensitive "contains" over several fields; a blank term matches everything. */
export function filterBySearch<T>(items: readonly T[], term: string, fields: (item: T) => string[]): readonly T[] {
  const needle = term.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((item) => fields(item).some((field) => field.toLowerCase().includes(needle)));
}
