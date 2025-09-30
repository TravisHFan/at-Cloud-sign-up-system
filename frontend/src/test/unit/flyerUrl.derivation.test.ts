import { describe, it, expect } from "vitest";
import {
  deriveFlyerUrlForUpdate,
  classifyFlyerDerivation,
  FlyerDerivationCase,
} from "../../utils/flyerUrl";

describe("deriveFlyerUrlForUpdate", () => {
  it("returns null for removal when original exists and form cleared", () => {
    expect(deriveFlyerUrlForUpdate("https://old.png", "")).toBeNull();
    expect(classifyFlyerDerivation("https://old.png", "")).toBe(
      FlyerDerivationCase.Removal
    );
  });

  it("returns undefined (omit) when no original and form empty", () => {
    expect(deriveFlyerUrlForUpdate(null, "")).toBeUndefined();
    expect(classifyFlyerDerivation(null, "")).toBe(FlyerDerivationCase.Omit);
  });

  it("returns undefined (no change) when unchanged", () => {
    expect(
      deriveFlyerUrlForUpdate("https://same.png", "https://same.png")
    ).toBeUndefined();
    expect(
      classifyFlyerDerivation("https://same.png", "https://same.png")
    ).toBe(FlyerDerivationCase.NoChange);
  });

  it("trims whitespace and detects removal", () => {
    expect(deriveFlyerUrlForUpdate("https://x.png", "   ")).toBeNull();
  });

  it("treats whitespace new value as omit when no original", () => {
    expect(deriveFlyerUrlForUpdate(null, "   ")).toBeUndefined();
  });

  it("returns new string for replacement when different non-empty value", () => {
    expect(deriveFlyerUrlForUpdate("https://old.png", "https://new.png")).toBe(
      "https://new.png"
    );
    expect(classifyFlyerDerivation("https://old.png", "https://new.png")).toBe(
      FlyerDerivationCase.Replacement
    );
  });

  it("returns undefined when formValue is undefined (no touch)", () => {
    expect(
      deriveFlyerUrlForUpdate("https://old.png", undefined)
    ).toBeUndefined();
  });

  it("returns undefined when formValue is null (treat as untouched)", () => {
    expect(deriveFlyerUrlForUpdate("https://old.png", null)).toBeUndefined();
  });
});
