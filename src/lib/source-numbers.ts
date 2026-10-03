/** Recognize exact source numerals, including strict comma-grouped thousands; never infer missing values. */
export function sourceNumbers(excerpt: string): number[] {
  return (excerpt.match(/[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g) || []).map(value => Number(value.replaceAll(',', '')));
}
