// Centralized flyer URL derivation logic for Event/Program update payloads.
// Rules:
// 1. If there was an original flyer (non-null, non-empty) and form value is an empty string => user intends to remove => return null.
// 2. If form value is a non-empty string and different from original => replacement => return that string.
// 3. If form value is empty string and there was no original flyer => nothing provided => return undefined (omit field).
// 4. If form value equals original (including both undefined/empty mapping to original) => no change => return undefined.
// 5. If form value is explicitly undefined (field untouched) => no change => return undefined.
// 6. Treat strings consisting only of whitespace the same as empty string.

export function deriveFlyerUrlForUpdate(
  original: string | null | undefined,
  formValue: string | null | undefined
): string | null | undefined {
  const normalizedOriginal =
    original && original.trim().length > 0 ? original : null;
  if (formValue == null) {
    // null or undefined form value: user did not change (we never set null in form), so no change
    return undefined;
  }
  const trimmed = formValue.trim();
  const hasOriginal = !!normalizedOriginal;

  // Removal intent
  if (trimmed === "" && hasOriginal) return null;

  // Nothing provided and nothing existed
  if (trimmed === "" && !hasOriginal) return undefined;

  // Replacement or unchanged
  if (trimmed === normalizedOriginal) return undefined; // unchanged

  return trimmed; // new value
}

// Convenience helper for unit tests / explicit branching visibility
// Using a const object instead of enum to comply with erasableSyntaxOnly restrictions.
export const FlyerDerivationCase = {
  Removal: "removal",
  Replacement: "replacement",
  NoChange: "no-change",
  Omit: "omit",
} as const;
export type FlyerDerivationCase =
  (typeof FlyerDerivationCase)[keyof typeof FlyerDerivationCase];

export function classifyFlyerDerivation(
  original: string | null | undefined,
  formValue: string | null | undefined
): FlyerDerivationCase {
  const result = deriveFlyerUrlForUpdate(original, formValue);
  if (result === null) return FlyerDerivationCase.Removal;
  if (result === undefined) {
    // Distinguish omit vs no-change (both map to undefined). If original exists and form preserved it => no-change.
    const normalizedOriginal =
      original && original.trim().length > 0 ? original : null;
    if (
      normalizedOriginal &&
      formValue &&
      formValue.trim() === normalizedOriginal
    ) {
      return FlyerDerivationCase.NoChange;
    }
    return FlyerDerivationCase.Omit;
  }
  return FlyerDerivationCase.Replacement;
}
