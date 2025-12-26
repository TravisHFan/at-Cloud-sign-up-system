/**
 * eventPermissions.test.ts
 *
 * Unit tests for event permission utilities.
 */
import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import { isEventOrganizer } from "../../../../src/utils/event/eventPermissions";

describe("eventPermissions", () => {
  describe("isEventOrganizer", () => {
    const testUserId = new Types.ObjectId();
    const otherUserId = new Types.ObjectId();

    describe("creator check", () => {
      it("should return true when user is the event creator (ObjectId)", () => {
        const event = {
          createdBy: testUserId,
          organizerDetails: [],
        };

        const result = isEventOrganizer(event, testUserId.toString());

        expect(result).toBe(true);
      });

      it("should return true when user is the event creator (string)", () => {
        const event = {
          createdBy: testUserId.toString(),
          organizerDetails: [],
        };

        const result = isEventOrganizer(event, testUserId.toString());

        expect(result).toBe(true);
      });

      it("should return false when user is not the creator", () => {
        const event = {
          createdBy: otherUserId,
          organizerDetails: [],
        };

        const result = isEventOrganizer(event, testUserId.toString());

        expect(result).toBe(false);
      });
    });

    describe("co-organizer check", () => {
      it("should return true when user is a co-organizer (ObjectId)", () => {
        const event = {
          createdBy: otherUserId,
          organizerDetails: [{ userId: testUserId }],
        };

        const result = isEventOrganizer(event, testUserId.toString());

        expect(result).toBe(true);
      });

      it("should return true when user is a co-organizer (string)", () => {
        const event = {
          createdBy: otherUserId,
          organizerDetails: [{ userId: testUserId.toString() }],
        };

        const result = isEventOrganizer(event, testUserId.toString());

        expect(result).toBe(true);
      });

      it("should return true when user is one of multiple co-organizers", () => {
        const coOrg1 = new Types.ObjectId();
        const coOrg2 = new Types.ObjectId();
        const event = {
          createdBy: otherUserId,
          organizerDetails: [
            { userId: coOrg1 },
            { userId: testUserId },
            { userId: coOrg2 },
          ],
        };

        const result = isEventOrganizer(event, testUserId.toString());

        expect(result).toBe(true);
      });

      it("should return false when user is not in co-organizers list", () => {
        const coOrg1 = new Types.ObjectId();
        const event = {
          createdBy: otherUserId,
          organizerDetails: [{ userId: coOrg1 }],
        };

        const result = isEventOrganizer(event, testUserId.toString());

        expect(result).toBe(false);
      });
    });

    describe("edge cases", () => {
      it("should return false when createdBy is undefined and user not in organizers", () => {
        const event = {
          createdBy: undefined,
          organizerDetails: [],
        };

        const result = isEventOrganizer(event, testUserId.toString());

        expect(result).toBe(false);
      });

      it("should return false when organizerDetails is undefined", () => {
        const event = {
          createdBy: otherUserId,
          organizerDetails: undefined,
        };

        const result = isEventOrganizer(event, testUserId.toString());

        expect(result).toBe(false);
      });

      it("should return false when organizerDetails is empty array", () => {
        const event = {
          createdBy: otherUserId,
          organizerDetails: [],
        };

        const result = isEventOrganizer(event, testUserId.toString());

        expect(result).toBe(false);
      });

      it("should handle organizer with undefined userId", () => {
        const event = {
          createdBy: otherUserId,
          organizerDetails: [{ userId: undefined }, { userId: testUserId }],
        };

        const result = isEventOrganizer(event, testUserId.toString());

        expect(result).toBe(true);
      });

      it("should return false when all organizer userIds are undefined", () => {
        const event = {
          createdBy: otherUserId,
          organizerDetails: [{ userId: undefined }, {}],
        };

        const result = isEventOrganizer(event, testUserId.toString());

        expect(result).toBe(false);
      });

      it("should handle mixed ObjectId and string in organizerDetails", () => {
        const coOrg1 = new Types.ObjectId();
        const event = {
          createdBy: otherUserId,
          organizerDetails: [
            { userId: coOrg1 },
            { userId: testUserId.toString() },
          ],
        };

        const result = isEventOrganizer(event, testUserId.toString());

        expect(result).toBe(true);
      });

      it("should prioritize creator check over co-organizer check", () => {
        // User is both creator and co-organizer - should return true immediately
        const event = {
          createdBy: testUserId,
          organizerDetails: [{ userId: testUserId }],
        };

        const result = isEventOrganizer(event, testUserId.toString());

        expect(result).toBe(true);
      });
    });
  });
});
