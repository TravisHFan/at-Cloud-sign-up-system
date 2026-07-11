const MAX_SEARCH_LENGTH = 100;

/** Normalize user-provided search text before it reaches a query engine. */
export function normalizeSearchText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, MAX_SEARCH_LENGTH);
}
/** Escape input that will be embedded in a MongoDB regular expression. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a literal MongoDB text-search expression. Quoting each token prevents
 * operators such as leading minus signs or user-supplied quotes from changing
 * the meaning of the query.
 */
export function toLiteralTextSearch(value: unknown): string {
  const normalized = normalizeSearchText(value);
  if (!normalized) return "";

  return normalized
    .split(" ")
    .map((token) => token.replace(/["\\]/g, "").trim())
    .filter(Boolean)
    .map((token) => `"${token}"`)
    .join(" ");
}
