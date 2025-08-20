import { describe, it, expect } from "vitest";
import { formatPhoneInput, normalizePhoneForSubmit } from "../../utils/phone";

describe("phone utils", () => {
  it("formatPhoneInput strips disallowed characters and normalizes whitespace", () => {
    expect(formatPhoneInput("+1 (555) 123-4567")).toBe("+1 (555) 123-4567");
    expect(formatPhoneInput("+1  555\t123\n4567 ext#9")).toBe(
      "+1 555 123 4567 9"
    );
    expect(formatPhoneInput("abc555xyz123!!4567??")).toBe("5551234567");
  });

  it("normalizePhoneForSubmit trims and collapses spaces only", () => {
    expect(normalizePhoneForSubmit("  +1  555  123  4567  ")).toBe(
      "+1 555 123 4567"
    );
    expect(normalizePhoneForSubmit("(020)  7946 0018")).toBe("(020) 7946 0018");
  });
});
