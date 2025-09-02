import { describe, it, expect } from "vitest";
import { getRolesByEventType } from "../../config/eventRoles";

describe("Workshop roles preset (frontend)", () => {
  it("returns updated workshop roles with new names and without old ones", () => {
    const roles = getRolesByEventType("Effective Communication Workshop");
    const names = new Set(roles.map((r) => r.name));

    // New roles present
    [
      "Opening Keynote Speaker",
      "Evaluators",
      "Closing Keynote Speaker",
      "Content Master",
      "Meeting Timer",
    ].forEach((n) => expect(names.has(n)).toBe(true));

    // Old ones removed
    ["Main Mentor", "Co-coach"].forEach((n) =>
      expect(names.has(n)).toBe(false)
    );
  });
});
