/**
 * Competition ranking ("1, 1, 3") over a list that is already sorted best-first:
 * items with the same `score` share a place and the following place is skipped.
 */
export function assignPlaces<T>(sorted: readonly T[], score: (item: T) => number): number[] {
  const places: number[] = [];
  sorted.forEach((item, index) => {
    const previousPlace = places[index - 1];
    places.push(previousPlace !== undefined && score(sorted[index - 1]!) === score(item) ? previousPlace : index + 1);
  });
  return places;
}
