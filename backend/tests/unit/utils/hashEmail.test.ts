import { describe, it, expect } from "vitest";
import { hashEmail } from "../../../src/utils/privacy";

describe("hashEmail", () => {
  it("produces deterministic sha256 for lowercase", () => {
    const h1 = hashEmail("User@example.com");
    const h2 = hashEmail("user@example.com");
    expect(h1).toBe(h2);
  });

  it("differs for different emails", () => {
    const a = hashEmail("a@example.com");
    const b = hashEmail("b@example.com");
    expect(a).not.toBe(b);
  });

  it("trims whitespace", () => {
    const a = hashEmail("  spaced@example.com  ");
    const b = hashEmail("spaced@example.com");
    expect(a).toBe(b);
  });
});
