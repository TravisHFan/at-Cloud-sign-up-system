import { describe, it, expect } from "vitest";
import { EmailService } from "../../../src/services/infrastructure/emailService";

// Simple test to verify real email service behavior with realistic data
describe("EmailService Real Data Test", () => {
  it("should handle realistic assignment email data", async () => {
    const realisticEventData = {
      id: "66e8b7d4c123456789abcdef", // MongoDB ObjectId format
      _id: "66e8b7d4c123456789abcdef",
      title: "Team Planning Meeting",
      date: "2024-10-15",
      endDate: "2024-10-15",
      time: "14:00",
      endTime: "16:00",
      timeZone: "America/Los_Angeles",
      location: "Conference Room B",
      purpose: "Planning session for Q4 objectives and team coordination",
    };

    const mockData = {
      event: realisticEventData,
      user: {
        firstName: "John",
        lastName: "Doe",
        username: "johndoe",
      },
      roleName: "Meeting Facilitator",
      actor: {
        firstName: "Jane",
        lastName: "Smith",
      },
      rejectionToken: "abc123def456",
    };

    // This will log the actual ICS generation attempt
    const result = await EmailService.sendEventRoleAssignedEmail(
      "john.doe@example.com",
      mockData
    );

    expect(result).toBe(true);
  });

  it("should handle event with minimal data", async () => {
    const minimalEventData = {
      id: "66e8b7d4c123456789abcdef",
      title: "Quick Standup",
      date: "2024-10-15",
      time: "09:00",
      // Missing endDate, endTime, location, purpose, timeZone
    };

    const mockData = {
      event: minimalEventData,
      user: { firstName: "John" },
      roleName: "Participant",
      actor: { firstName: "Jane", lastName: "Smith" },
    };

    // This should trigger our warning logs for missing data
    const result = await EmailService.sendEventRoleAssignedEmail(
      "john.doe@example.com",
      mockData
    );

    expect(result).toBe(true);
  });
});
