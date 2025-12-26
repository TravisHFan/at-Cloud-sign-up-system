/**
 * OrganizerManagementService Unit Tests
 *
 * Tests organizer tracking and normalization:
 * - trackOldOrganizers: Extract organizer user IDs from event
 * - normalizeOrganizerDetails: Normalize organizer details from update request
 */

import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { OrganizerManagementService } from "../../../../src/services/event/OrganizerManagementService";
import type { IEvent } from "../../../../src/models/Event";

describe("OrganizerManagementService - Unit Tests", () => {
  const service = new OrganizerManagementService();

  describe("trackOldOrganizers", () => {
    it("should return empty array when organizerDetails is undefined", () => {
      const event = {} as IEvent;

      const result = service.trackOldOrganizers(event);

      expect(result).toEqual([]);
    });

    it("should return empty array when organizerDetails is null", () => {
      const event = { organizerDetails: null } as unknown as IEvent;

      const result = service.trackOldOrganizers(event);

      expect(result).toEqual([]);
    });

    it("should return empty array when organizerDetails is not an array", () => {
      const event = { organizerDetails: "not an array" } as unknown as IEvent;

      const result = service.trackOldOrganizers(event);

      expect(result).toEqual([]);
    });

    it("should return empty array when organizerDetails is empty array", () => {
      const event = { organizerDetails: [] } as unknown as IEvent;

      const result = service.trackOldOrganizers(event);

      expect(result).toEqual([]);
    });

    it("should extract user IDs from organizers with ObjectId userId", () => {
      const userId1 = new Types.ObjectId();
      const userId2 = new Types.ObjectId();
      const event = {
        organizerDetails: [
          { userId: userId1, name: "Organizer 1" },
          { userId: userId2, name: "Organizer 2" },
        ],
      } as IEvent;

      const result = service.trackOldOrganizers(event);

      expect(result).toEqual([userId1.toString(), userId2.toString()]);
    });

    it("should extract user IDs from organizers with string userId", () => {
      const userId1 = new Types.ObjectId().toString();
      const userId2 = new Types.ObjectId().toString();
      const event = {
        organizerDetails: [
          { userId: userId1 as any, name: "Organizer 1" },
          { userId: userId2 as any, name: "Organizer 2" },
        ],
      } as IEvent;

      const result = service.trackOldOrganizers(event);

      expect(result).toEqual([userId1, userId2]);
    });

    it("should filter out organizers without userId", () => {
      const userId1 = new Types.ObjectId();
      const event = {
        organizerDetails: [
          { userId: userId1, name: "Organizer 1" },
          { name: "Organizer without ID" },
          { userId: undefined, name: "Organizer with undefined ID" },
        ],
      } as IEvent;

      const result = service.trackOldOrganizers(event);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(userId1.toString());
    });

    it("should handle mixed ObjectId and string userIds", () => {
      const objectId = new Types.ObjectId();
      const stringId = new Types.ObjectId().toString();
      const event = {
        organizerDetails: [
          { userId: objectId, name: "Organizer 1" },
          { userId: stringId as any, name: "Organizer 2" },
        ],
      } as IEvent;

      const result = service.trackOldOrganizers(event);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe(objectId.toString());
      expect(result[1]).toBe(stringId);
    });
  });

  describe("normalizeOrganizerDetails", () => {
    it("should return empty array when input is not an array", () => {
      expect(service.normalizeOrganizerDetails(null as any)).toEqual([]);
      expect(service.normalizeOrganizerDetails(undefined as any)).toEqual([]);
      expect(service.normalizeOrganizerDetails("not array" as any)).toEqual([]);
      expect(service.normalizeOrganizerDetails({} as any)).toEqual([]);
    });

    it("should return empty array when input is empty array", () => {
      const result = service.normalizeOrganizerDetails([]);

      expect(result).toEqual([]);
    });

    it("should normalize organizer details with placeholder email and phone", () => {
      const userId = new Types.ObjectId().toString();
      const organizers = [
        {
          userId,
          name: "John Doe",
          role: "Co-organizer",
          avatar: "avatar.jpg",
          gender: "male",
          email: "john@example.com", // Should be replaced
          phone: "+1234567890", // Should be replaced
        },
      ];

      const result = service.normalizeOrganizerDetails(organizers);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        userId,
        name: "John Doe",
        role: "Co-organizer",
        avatar: "avatar.jpg",
        gender: "male",
        email: "placeholder@example.com",
        phone: "Phone not provided",
      });
    });

    it("should normalize multiple organizers", () => {
      const userId1 = new Types.ObjectId().toString();
      const userId2 = new Types.ObjectId().toString();
      const organizers = [
        { userId: userId1, name: "John", role: "Lead" },
        { userId: userId2, name: "Jane", role: "Support" },
      ];

      const result = service.normalizeOrganizerDetails(organizers);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("John");
      expect(result[0].email).toBe("placeholder@example.com");
      expect(result[1].name).toBe("Jane");
      expect(result[1].phone).toBe("Phone not provided");
    });

    it("should handle organizers with missing optional fields", () => {
      const userId = new Types.ObjectId().toString();
      const organizers = [{ userId, name: "John" }];

      const result = service.normalizeOrganizerDetails(organizers);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        userId,
        name: "John",
        role: undefined,
        avatar: undefined,
        gender: undefined,
        email: "placeholder@example.com",
        phone: "Phone not provided",
      });
    });

    it("should strip existing email and phone regardless of value", () => {
      const organizers = [
        {
          userId: new Types.ObjectId().toString(),
          name: "Test",
          email: "real@email.com",
          phone: "+1-555-123-4567",
        },
      ];

      const result = service.normalizeOrganizerDetails(organizers);

      expect(result[0].email).toBe("placeholder@example.com");
      expect(result[0].phone).toBe("Phone not provided");
    });
  });
});
