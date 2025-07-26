/**
 * Mongoose Import Test
 *
 * Tests that models can be imported without mongoose connection issues
 */

import { describe, it, expect } from "vitest";
import { User, Event, Registration } from "../../src/models";

describe("🔗 Mongoose Import Tests", () => {
  it("should import User model without connection issues", () => {
    expect(User).toBeDefined();
    expect(typeof User.find).toBe("function");
  });

  it("should import Event model without connection issues", () => {
    expect(Event).toBeDefined();
    expect(typeof Event.find).toBe("function");
  });

  it("should import Registration model without connection issues", () => {
    expect(Registration).toBeDefined();
    expect(typeof Registration.find).toBe("function");
  });

  it("should allow model method calls without errors", async () => {
    // These should work because of our mocks
    const users = await User.find();
    const events = await Event.find();
    const registrations = await Registration.find();

    expect(Array.isArray(users)).toBe(true);
    expect(Array.isArray(events)).toBe(true);
    expect(Array.isArray(registrations)).toBe(true);
  });

  it("should handle model creation calls without errors", async () => {
    // These should work because of our mocks
    const user = await User.create({
      username: "test",
      email: "test@example.com",
    });
    const count = await Registration.countDocuments();

    expect(user).toBeDefined();
    expect(typeof count).toBe("number");
  });
});
