import { describe, it, expect } from "vitest";
import { EventOrganizerDataService } from "../../../../src/services/event/EventOrganizerDataService";

describe("EventOrganizerDataService", () => {
  describe("processOrganizerDetails", () => {
    it("returns empty array when organizerDetails is undefined", () => {
      const result =
        EventOrganizerDataService.processOrganizerDetails(undefined);

      expect(result).toEqual([]);
    });

    it("returns empty array when organizerDetails is null", () => {
      const result = EventOrganizerDataService.processOrganizerDetails(
        null as any
      );

      expect(result).toEqual([]);
    });

    it("returns empty array when organizerDetails is not an array", () => {
      const result = EventOrganizerDataService.processOrganizerDetails(
        "not-an-array" as any
      );

      expect(result).toEqual([]);
    });

    it("returns empty array for empty organizerDetails array", () => {
      const result = EventOrganizerDataService.processOrganizerDetails([]);

      expect(result).toEqual([]);
    });

    it("processes single organizer with all fields", () => {
      const input = [
        {
          userId: "user-123",
          name: "John Doe",
          role: "Main Organizer",
          avatar: "https://example.com/avatar.jpg",
          gender: "male" as const,
        },
      ];

      const result = EventOrganizerDataService.processOrganizerDetails(input);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        userId: "user-123",
        name: "John Doe",
        role: "Main Organizer",
        avatar: "https://example.com/avatar.jpg",
        gender: "male",
        email: "placeholder@example.com",
        phone: "Phone not provided",
      });
    });

    it("processes multiple organizers", () => {
      const input = [
        {
          userId: "user-1",
          name: "Jane Smith",
          role: "Main Organizer",
          gender: "female" as const,
        },
        {
          userId: "user-2",
          name: "Bob Wilson",
          role: "Co-organizer",
          gender: "male" as const,
        },
      ];

      const result = EventOrganizerDataService.processOrganizerDetails(input);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Jane Smith");
      expect(result[0].role).toBe("Main Organizer");
      expect(result[1].name).toBe("Bob Wilson");
      expect(result[1].role).toBe("Co-organizer");
    });

    it("handles organizers with missing optional fields", () => {
      const input = [
        {
          userId: "user-123",
        },
      ];

      const result = EventOrganizerDataService.processOrganizerDetails(input);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        userId: "user-123",
        name: undefined,
        role: undefined,
        avatar: undefined,
        gender: undefined,
        email: "placeholder@example.com",
        phone: "Phone not provided",
      });
    });

    it("always includes placeholder email and phone", () => {
      const input = [
        {
          userId: "user-456",
          name: "Test User",
        },
      ];

      const result = EventOrganizerDataService.processOrganizerDetails(input);

      expect(result[0].email).toBe("placeholder@example.com");
      expect(result[0].phone).toBe("Phone not provided");
    });

    it("handles organizer with only name field", () => {
      const input = [
        {
          name: "Anonymous Organizer",
        },
      ];

      const result = EventOrganizerDataService.processOrganizerDetails(input);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Anonymous Organizer");
      expect(result[0].userId).toBeUndefined();
    });

    it("preserves ObjectId-like userId values", () => {
      const objectId = { toString: () => "507f191e810c19729de860ea" };
      const input = [
        {
          userId: objectId,
          name: "User With ObjectId",
        },
      ];

      const result = EventOrganizerDataService.processOrganizerDetails(input);

      expect(result[0].userId).toBe(objectId);
    });

    it("handles empty object in array", () => {
      const input = [{}];

      const result = EventOrganizerDataService.processOrganizerDetails(input);

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe("placeholder@example.com");
      expect(result[0].phone).toBe("Phone not provided");
    });

    it("handles mixed valid and partial organizers", () => {
      const input = [
        {
          userId: "user-1",
          name: "Complete User",
          role: "Main Organizer",
          avatar: "https://example.com/user1.jpg",
          gender: "female" as const,
        },
        {
          userId: "user-2",
          // Only userId provided
        },
        {
          name: "No User ID",
          role: "Helper",
        },
      ];

      const result = EventOrganizerDataService.processOrganizerDetails(input);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe("Complete User");
      expect(result[1].userId).toBe("user-2");
      expect(result[1].name).toBeUndefined();
      expect(result[2].name).toBe("No User ID");
      expect(result[2].userId).toBeUndefined();
    });
  });
});
