import { describe, it, expect } from "vitest";
import { EventController } from "../../src/controllers/eventController";

describe("EventController.validateRolesAgainstTemplates", () => {
  it("allows a custom role name not present in template (e.g., Participant when template has Attendee)", () => {
    const roles = [{ name: "Participant", maxParticipants: 5 }];
    // Access the private method via bracket notation for test purposes
    const result = (EventController as any)["validateRolesAgainstTemplates"](
      "Webinar",
      roles
    );
    expect(result.valid).toBe(true);
  });

  it("enforces duplicate role names", () => {
    const roles = [
      { name: "Participant", maxParticipants: 5 },
      { name: "Participant", maxParticipants: 5 },
    ];
    const result = (EventController as any)["validateRolesAgainstTemplates"](
      "Webinar",
      roles
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.stringContaining("Duplicate role not allowed")
    );
  });

  it("caps custom role maxParticipants at 300", () => {
    const roles = [{ name: "HugeRole", maxParticipants: 301 }];
    const result = (EventController as any)["validateRolesAgainstTemplates"](
      "Webinar",
      roles
    );
    expect(result.valid).toBe(false);
    expect(result.errors?.[0]).toMatch(/exceeds maximum allowed/);
  });
});
