import { describe, it, expect } from "vitest";
// Use relative import to avoid alias resolution issues in Vitest
import * as ProfileModule from "../pages/Profile";

describe("Profile module export", () => {
  it("should export a component (default or named)", () => {
    expect(ProfileModule).toBeDefined();
    const hasDefault = typeof (ProfileModule as any).default === "function";
    const hasNamed = typeof (ProfileModule as any).Profile === "function";
    expect(hasDefault || hasNamed).toBe(true);
  });
});
