import { describe, it, expect } from "vitest";
import { getEventTemplates } from "../../../src/config/eventTemplates";

describe("Workshop role template updates", () => {
  it("includes new keynote/evaluator/content/timer roles and omits old names", () => {
    const { templates } = getEventTemplates();
    const workshop = templates["Effective Communication Workshop"] || [];
    const names = new Set(workshop.map((r) => r.name));

    // New roles present
    [
      "Opening Keynote Speaker",
      "Evaluators",
      "Closing Keynote Speaker",
      "Content Master",
      "Meeting Timer",
    ].forEach((n) => expect(names.has(n)).toBe(true));

    // Old roles removed
    ["Main Mentor", "Co-coach"].forEach((n) =>
      expect(names.has(n)).toBe(false)
    );

    // Still includes group roles A..F
    ["A", "B", "C", "D", "E", "F"].forEach((g) => {
      expect(names.has(`Group ${g} Leader`)).toBe(true);
      expect(names.has(`Group ${g} Participants`)).toBe(true);
    });
  });
});
