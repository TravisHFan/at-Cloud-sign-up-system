/**
 * EventAccessControlService Unit Tests
 *
 * Tests the access control logic for paid events:
 * - System admin access
 * - Organizer/co-organizer access
 * - Free event access
 * - Program purchase access
 * - Event purchase access
 * - Format access reason
 * - Batch user access check
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import mongoose from "mongoose";

// Mock the models before importing the service
vi.mock("../../../../src/models/Event", () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock("../../../../src/models/Purchase", () => ({
  default: {
    findOne: vi.fn(),
  },
}));

vi.mock("../../../../src/models/User", () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock("../../../../src/services/LoggerService", () => ({
  Logger: {
    getInstance: () => ({
      child: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      }),
    }),
  },
}));

import eventAccessControlService from "../../../../src/services/event/EventAccessControlService";
import Event from "../../../../src/models/Event";
import Purchase from "../../../../src/models/Purchase";
import User from "../../../../src/models/User";

describe("EventAccessControlService - Unit Tests", () => {
  const validUserId = new mongoose.Types.ObjectId().toString();
  const validEventId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkUserAccess", () => {
    describe("free event access", () => {
      it("should return free_event access when pricing.isFree is true", async () => {
        vi.mocked(Event.findById).mockResolvedValueOnce({
          _id: validEventId,
          pricing: { isFree: true },
          createdBy: new mongoose.Types.ObjectId(),
        });

        const result = await eventAccessControlService.checkUserAccess(
          validUserId,
          validEventId
        );

        expect(result).toEqual({
          hasAccess: true,
          requiresPurchase: false,
          accessReason: "free_event",
        });
      });

      it("should return free_event access when pricing is undefined (default free)", async () => {
        vi.mocked(Event.findById).mockResolvedValueOnce({
          _id: validEventId,
          createdBy: new mongoose.Types.ObjectId(),
        });

        const result = await eventAccessControlService.checkUserAccess(
          validUserId,
          validEventId
        );

        expect(result).toEqual({
          hasAccess: true,
          requiresPurchase: false,
          accessReason: "free_event",
        });
      });

      it("should return free_event access when pricing.isFree is undefined (default free)", async () => {
        vi.mocked(Event.findById).mockResolvedValueOnce({
          _id: validEventId,
          pricing: {},
          createdBy: new mongoose.Types.ObjectId(),
        });

        const result = await eventAccessControlService.checkUserAccess(
          validUserId,
          validEventId
        );

        expect(result).toEqual({
          hasAccess: true,
          requiresPurchase: false,
          accessReason: "free_event",
        });
      });
    });

    describe("event not found", () => {
      it("should throw error when event is not found", async () => {
        vi.mocked(Event.findById).mockResolvedValueOnce(null);

        await expect(
          eventAccessControlService.checkUserAccess(validUserId, validEventId)
        ).rejects.toThrow("Event not found");
      });
    });

    describe("user not found", () => {
      it("should throw error when user is not found", async () => {
        vi.mocked(Event.findById).mockResolvedValueOnce({
          _id: validEventId,
          pricing: { isFree: false },
          createdBy: new mongoose.Types.ObjectId(),
        });
        vi.mocked(User.findById).mockResolvedValueOnce(null);

        await expect(
          eventAccessControlService.checkUserAccess(validUserId, validEventId)
        ).rejects.toThrow("User not found");
      });
    });

    describe("system admin access", () => {
      it("should return system_admin access for Super Admin", async () => {
        const creatorId = new mongoose.Types.ObjectId();
        vi.mocked(Event.findById).mockResolvedValueOnce({
          _id: validEventId,
          pricing: { isFree: false },
          createdBy: creatorId,
        });
        vi.mocked(User.findById).mockResolvedValueOnce({
          _id: validUserId,
          role: "Super Admin",
        });

        const result = await eventAccessControlService.checkUserAccess(
          validUserId,
          validEventId
        );

        expect(result).toEqual({
          hasAccess: true,
          requiresPurchase: false,
          accessReason: "system_admin",
        });
      });

      it("should return system_admin access for Administrator", async () => {
        const creatorId = new mongoose.Types.ObjectId();
        vi.mocked(Event.findById).mockResolvedValueOnce({
          _id: validEventId,
          pricing: { isFree: false },
          createdBy: creatorId,
        });
        vi.mocked(User.findById).mockResolvedValueOnce({
          _id: validUserId,
          role: "Administrator",
        });

        const result = await eventAccessControlService.checkUserAccess(
          validUserId,
          validEventId
        );

        expect(result).toEqual({
          hasAccess: true,
          requiresPurchase: false,
          accessReason: "system_admin",
        });
      });
    });

    describe("organizer access", () => {
      it("should return organizer access when user is event creator", async () => {
        const userIdObj = new mongoose.Types.ObjectId(validUserId);
        vi.mocked(Event.findById).mockResolvedValueOnce({
          _id: validEventId,
          pricing: { isFree: false },
          createdBy: userIdObj,
        });
        vi.mocked(User.findById).mockResolvedValueOnce({
          _id: userIdObj,
          role: "Member",
        });

        const result = await eventAccessControlService.checkUserAccess(
          validUserId,
          validEventId
        );

        expect(result).toEqual({
          hasAccess: true,
          requiresPurchase: false,
          accessReason: "organizer",
        });
      });
    });

    describe("co-organizer access", () => {
      it("should return co_organizer access when user is a co-organizer", async () => {
        const userIdObj = new mongoose.Types.ObjectId(validUserId);
        const creatorId = new mongoose.Types.ObjectId();
        vi.mocked(Event.findById).mockResolvedValueOnce({
          _id: validEventId,
          pricing: { isFree: false },
          createdBy: creatorId,
          organizerDetails: [{ userId: userIdObj, name: "Co-organizer" }],
        });
        vi.mocked(User.findById).mockResolvedValueOnce({
          _id: userIdObj,
          role: "Member",
        });

        const result = await eventAccessControlService.checkUserAccess(
          validUserId,
          validEventId
        );

        expect(result).toEqual({
          hasAccess: true,
          requiresPurchase: false,
          accessReason: "co_organizer",
        });
      });

      it("should not grant co_organizer if organizerDetails is empty", async () => {
        const userIdObj = new mongoose.Types.ObjectId(validUserId);
        const creatorId = new mongoose.Types.ObjectId();
        vi.mocked(Event.findById).mockResolvedValueOnce({
          _id: validEventId,
          pricing: { isFree: false },
          createdBy: creatorId,
          organizerDetails: [],
          programLabels: [],
        });
        vi.mocked(User.findById).mockResolvedValueOnce({
          _id: userIdObj,
          role: "Member",
        });
        vi.mocked(Purchase.findOne).mockResolvedValueOnce(null);

        const result = await eventAccessControlService.checkUserAccess(
          validUserId,
          validEventId
        );

        expect(result).toEqual({
          hasAccess: false,
          requiresPurchase: true,
        });
      });
    });

    describe("program purchase access", () => {
      it("should return program_purchase access when user purchased a linked program", async () => {
        const userIdObj = new mongoose.Types.ObjectId(validUserId);
        const creatorId = new mongoose.Types.ObjectId();
        const programId = new mongoose.Types.ObjectId();
        vi.mocked(Event.findById).mockResolvedValueOnce({
          _id: validEventId,
          pricing: { isFree: false },
          createdBy: creatorId,
          organizerDetails: [],
          programLabels: [programId],
        });
        vi.mocked(User.findById).mockResolvedValueOnce({
          _id: userIdObj,
          role: "Member",
        });
        vi.mocked(Purchase.findOne).mockResolvedValueOnce({
          _id: new mongoose.Types.ObjectId(),
          purchaseType: "program",
          programId,
          status: "completed",
        });

        const result = await eventAccessControlService.checkUserAccess(
          validUserId,
          validEventId
        );

        expect(result).toEqual({
          hasAccess: true,
          requiresPurchase: false,
          accessReason: "program_purchase",
        });
        expect(Purchase.findOne).toHaveBeenCalledWith({
          userId: expect.any(mongoose.Types.ObjectId),
          purchaseType: "program",
          programId: { $in: [programId] },
          status: "completed",
        });
      });
    });

    describe("event purchase access", () => {
      it("should return event_purchase access when user purchased this event", async () => {
        const userIdObj = new mongoose.Types.ObjectId(validUserId);
        const creatorId = new mongoose.Types.ObjectId();
        vi.mocked(Event.findById).mockResolvedValueOnce({
          _id: validEventId,
          pricing: { isFree: false },
          createdBy: creatorId,
          organizerDetails: [],
          programLabels: [], // No program labels, so program check is skipped
        });
        vi.mocked(User.findById).mockResolvedValueOnce({
          _id: userIdObj,
          role: "Member",
        });
        // Only event purchase check happens (no programLabels)
        vi.mocked(Purchase.findOne).mockResolvedValueOnce({
          _id: new mongoose.Types.ObjectId(),
          purchaseType: "event",
          eventId: validEventId,
          status: "completed",
        });

        const result = await eventAccessControlService.checkUserAccess(
          validUserId,
          validEventId
        );

        expect(result).toEqual({
          hasAccess: true,
          requiresPurchase: false,
          accessReason: "event_purchase",
        });
      });
    });

    describe("no access (must purchase)", () => {
      it("should return requiresPurchase when no access conditions met", async () => {
        const userIdObj = new mongoose.Types.ObjectId(validUserId);
        const creatorId = new mongoose.Types.ObjectId();
        vi.mocked(Event.findById).mockResolvedValueOnce({
          _id: validEventId,
          pricing: { isFree: false },
          createdBy: creatorId,
          organizerDetails: [],
          programLabels: [], // No program labels
        });
        vi.mocked(User.findById).mockResolvedValueOnce({
          _id: userIdObj,
          role: "Member",
        });
        // No event purchase found
        vi.mocked(Purchase.findOne).mockResolvedValueOnce(null);

        const result = await eventAccessControlService.checkUserAccess(
          validUserId,
          validEventId
        );

        expect(result).toEqual({
          hasAccess: false,
          requiresPurchase: true,
        });
      });
    });

    describe("error handling", () => {
      it("should rethrow errors with logging", async () => {
        const dbError = new Error("Database connection failed");
        vi.mocked(Event.findById).mockRejectedValueOnce(dbError);

        await expect(
          eventAccessControlService.checkUserAccess(validUserId, validEventId)
        ).rejects.toThrow("Database connection failed");
      });
    });

    describe("ID type handling", () => {
      it("should accept string IDs", async () => {
        vi.mocked(Event.findById).mockResolvedValueOnce({
          _id: validEventId,
          pricing: { isFree: true },
          createdBy: new mongoose.Types.ObjectId(),
        });

        const result = await eventAccessControlService.checkUserAccess(
          validUserId,
          validEventId
        );

        expect(result.hasAccess).toBe(true);
      });

      it("should accept ObjectId instances", async () => {
        const userIdObj = new mongoose.Types.ObjectId(validUserId);
        const eventIdObj = new mongoose.Types.ObjectId(validEventId);

        vi.mocked(Event.findById).mockResolvedValueOnce({
          _id: eventIdObj,
          pricing: { isFree: true },
          createdBy: new mongoose.Types.ObjectId(),
        });

        const result = await eventAccessControlService.checkUserAccess(
          userIdObj,
          eventIdObj
        );

        expect(result.hasAccess).toBe(true);
      });
    });
  });

  describe("formatAccessReason", () => {
    it("should format system_admin correctly", () => {
      expect(eventAccessControlService.formatAccessReason("system_admin")).toBe(
        "Super Admin"
      );
    });

    it("should format organizer correctly", () => {
      expect(eventAccessControlService.formatAccessReason("organizer")).toBe(
        "Creator"
      );
    });

    it("should format co_organizer correctly", () => {
      expect(eventAccessControlService.formatAccessReason("co_organizer")).toBe(
        "Co-organizer"
      );
    });

    it("should format free_event correctly", () => {
      expect(eventAccessControlService.formatAccessReason("free_event")).toBe(
        "Free Event"
      );
    });

    it("should format program_purchase correctly", () => {
      expect(
        eventAccessControlService.formatAccessReason("program_purchase")
      ).toBe("Program Enrollee");
    });

    it("should format event_purchase correctly", () => {
      expect(
        eventAccessControlService.formatAccessReason("event_purchase")
      ).toBe("Event Ticket Holder");
    });
  });

  describe("checkMultipleUsersAccess", () => {
    it("should return access results for multiple users", async () => {
      const userId1 = new mongoose.Types.ObjectId().toString();
      const userId2 = new mongoose.Types.ObjectId().toString();

      // First user - free event
      vi.mocked(Event.findById).mockResolvedValueOnce({
        _id: validEventId,
        pricing: { isFree: true },
        createdBy: new mongoose.Types.ObjectId(),
      });
      // Second user - free event
      vi.mocked(Event.findById).mockResolvedValueOnce({
        _id: validEventId,
        pricing: { isFree: true },
        createdBy: new mongoose.Types.ObjectId(),
      });

      const results = await eventAccessControlService.checkMultipleUsersAccess(
        [userId1, userId2],
        validEventId
      );

      expect(results.size).toBe(2);
      expect(results.get(userId1)).toEqual({
        hasAccess: true,
        requiresPurchase: false,
        accessReason: "free_event",
      });
      expect(results.get(userId2)).toEqual({
        hasAccess: true,
        requiresPurchase: false,
        accessReason: "free_event",
      });
    });

    it("should handle errors for individual users gracefully", async () => {
      const userId1 = new mongoose.Types.ObjectId().toString();
      const userId2 = new mongoose.Types.ObjectId().toString();

      // First user - throws error
      vi.mocked(Event.findById).mockRejectedValueOnce(
        new Error("DB error for user 1")
      );
      // Second user - success
      vi.mocked(Event.findById).mockResolvedValueOnce({
        _id: validEventId,
        pricing: { isFree: true },
        createdBy: new mongoose.Types.ObjectId(),
      });

      const results = await eventAccessControlService.checkMultipleUsersAccess(
        [userId1, userId2],
        validEventId
      );

      expect(results.size).toBe(2);
      // User 1 should have default no-access due to error
      expect(results.get(userId1)).toEqual({
        hasAccess: false,
        requiresPurchase: true,
      });
      // User 2 should have access
      expect(results.get(userId2)).toEqual({
        hasAccess: true,
        requiresPurchase: false,
        accessReason: "free_event",
      });
    });

    it("should handle ObjectId instances in user array", async () => {
      const userIdObj = new mongoose.Types.ObjectId();

      vi.mocked(Event.findById).mockResolvedValueOnce({
        _id: validEventId,
        pricing: { isFree: true },
        createdBy: new mongoose.Types.ObjectId(),
      });

      const results = await eventAccessControlService.checkMultipleUsersAccess(
        [userIdObj],
        validEventId
      );

      expect(results.size).toBe(1);
      expect(results.get(userIdObj.toString())).toBeDefined();
    });
  });
});
