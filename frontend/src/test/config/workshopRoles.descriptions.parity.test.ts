import { describe, it, expect } from "vitest";
import { WORKSHOP_ROLES } from "../../config/eventRoles";

function expectedLeaderDescription(g: string) {
  return `\u2022 Lead Group ${g} in practicing the communication skills assigned last month\n\u2022 Deliver a 6\u20137 minute presentation (with PPT, role play, or story)\n\u2022 Receive feedback from mentors, evaluator`;
}

function getRoleDescription(name: string) {
  const r = WORKSHOP_ROLES.find((x) => x.name === name);
  if (!r) throw new Error(`Role not found: ${name}`);
  return r.description;
}

describe("Workshop Group Leader descriptions - client parity", () => {
  const groups = ["A", "B", "C", "D", "E", "F"] as const;
  for (const g of groups) {
    it(`Group ${g} Leader description matches expected multi-line bullets`, () => {
      expect(getRoleDescription(`Group ${g} Leader`)).toBe(
        expectedLeaderDescription(g)
      );
    });
  }
});
