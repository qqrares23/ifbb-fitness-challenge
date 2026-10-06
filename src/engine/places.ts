/**
 * Competition ranking ("1, 1, 3") over a list already sorted best-first by `compare`:
 * items that compare equal share a place and the following place is skipped.
 */
export function assignPlaces<T>(sorted: readonly T[], compare: (a: T, b: T) => number): number[] {
  const places: number[] = [];
  sorted.forEach((item, index) => {
    const previousPlace = places[index - 1];
    places.push(previousPlace !== undefined && compare(sorted[index - 1]!, item) === 0 ? previousPlace : index + 1);
  });
  return places;
}
