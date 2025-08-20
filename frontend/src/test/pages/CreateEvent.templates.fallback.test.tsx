import { describe, it, expect } from "vitest";

// Lightweight unit test for fallback role behavior
describe("CreateEvent templates fallback", () => {
  it("fallback roles include Webinar circle-specific breakout leads with default maxParticipants=2", async () => {
    // Import the fallback function directly to test behavior
    const { getRolesByEventType } = await import("../../config/eventRoles");

    // Test that Webinar fallback includes the four circle-specific roles
    const webinarRoles = getRolesByEventType("Webinar");

    const expectedRoleNames = [
      "Breakout Room Leads for E Circle",
      "Breakout Room Leads for M Circle",
      "Breakout Room Leads for B Circle",
      "Breakout Room Leads for A Circle",
    ];

    // Assert all four circle-specific roles exist
    for (const expectedRole of expectedRoleNames) {
      const role = webinarRoles.find((r) => r.name === expectedRole);
      expect(role).toBeDefined();
      expect(role?.maxParticipants).toBe(2);
    }

    // Assert we have exactly 4 circle-specific breakout roles (not more, not fewer)
    const circleRoles = webinarRoles.filter(
      (r) =>
        r.name.includes("Breakout Room Leads for") && r.name.includes("Circle")
    );
    expect(circleRoles).toHaveLength(4);
  });
});
