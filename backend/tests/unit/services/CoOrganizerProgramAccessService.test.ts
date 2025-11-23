/**
 * Unit Tests: CoOrganizerProgramAccessService
 *
 * Tests validation logic for co-organizer program access.
 * Ensures co-organizers have proper enrollment in paid programs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CoOrganizerProgramAccessService } from "../../../src/services/event/CoOrganizerProgramAccessService";
import mongoose from "mongoose";

// Mock the models
vi.mock("../../../src/models", () => ({
  Program: {
    find: vi.fn(),
  },
  Purchase: {
    findOne: vi.fn(),
  },
}));

import { Program, Purchase } from "../../../src/models";

describe("CoOrganizerProgramAccessService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validateCoOrganizerAccess", () => {
    it("should pass validation when no organizers are provided", async () => {
      const result =
        await CoOrganizerProgramAccessService.validateCoOrganizerAccess(
          undefined,
          ["program1"]
        );

      expect(result.valid).toBe(true);
    });

    it("should pass validation when organizers array is empty", async () => {
      const result =
        await CoOrganizerProgramAccessService.validateCoOrganizerAccess(
          [],
          ["program1"]
        );

      expect(result.valid).toBe(true);
    });

    it("should pass validation when no programs are provided", async () => {
      const organizers = [
        { userId: "user1", name: "John Doe" },
        { userId: "user2", name: "Jane Smith" },
      ];

      const result =
        await CoOrganizerProgramAccessService.validateCoOrganizerAccess(
          organizers,
          undefined
        );

      expect(result.valid).toBe(true);
    });

    it("should pass validation when programs array is empty", async () => {
      const organizers = [
        { userId: "user1", name: "John Doe" },
        { userId: "user2", name: "Jane Smith" },
      ];

      const result =
        await CoOrganizerProgramAccessService.validateCoOrganizerAccess(
          organizers,
          []
        );

      expect(result.valid).toBe(true);
    });

    it("should pass validation when all programs are free", async () => {
      const programId = new mongoose.Types.ObjectId();
      const organizers = [{ userId: "user1", name: "John Doe" }];

      // Mock Program.find to return free programs
      vi.mocked(Program.find).mockReturnValue({
        select: vi.fn().mockResolvedValue([
          {
            _id: programId,
            isFree: true,
            mentors: [],
          },
        ]),
      } as any);

      const result =
        await CoOrganizerProgramAccessService.validateCoOrganizerAccess(
          organizers,
          [programId.toString()]
        );

      expect(result.valid).toBe(true);
    });

    it("should pass validation when co-organizer is a mentor of paid program", async () => {
      const programId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();
      const organizers = [{ userId: userId.toString(), name: "John Doe" }];

      // Mock Program.find to return paid program with this user as mentor
      vi.mocked(Program.find).mockReturnValue({
        select: vi.fn().mockResolvedValue([
          {
            _id: programId,
            isFree: false,
            mentors: [{ userId: userId }],
          },
        ]),
      } as any);

      const result =
        await CoOrganizerProgramAccessService.validateCoOrganizerAccess(
          organizers,
          [programId.toString()]
        );

      expect(result.valid).toBe(true);
    });

    it("should pass validation when co-organizer purchased the paid program", async () => {
      const programId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();
      const organizers = [{ userId: userId.toString(), name: "John Doe" }];

      // Mock Program.find to return paid program without mentor status
      vi.mocked(Program.find).mockReturnValue({
        select: vi.fn().mockResolvedValue([
          {
            _id: programId,
            isFree: false,
            mentors: [],
          },
        ]),
      } as any);

      // Mock Purchase.findOne to return a completed purchase
      vi.mocked(Purchase.findOne).mockResolvedValue({
        userId: userId,
        programId: programId,
        status: "completed",
      } as any);

      const result =
        await CoOrganizerProgramAccessService.validateCoOrganizerAccess(
          organizers,
          [programId.toString()]
        );

      expect(result.valid).toBe(true);
    });

    it("should fail validation when co-organizer has no access to paid program", async () => {
      const programId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();
      const organizers = [{ userId: userId.toString(), name: "John Doe" }];

      // Mock Program.find to return paid program
      vi.mocked(Program.find).mockReturnValue({
        select: vi.fn().mockResolvedValue([
          {
            _id: programId,
            isFree: false,
            mentors: [],
          },
        ]),
      } as any);

      // Mock Purchase.findOne to return no purchase
      vi.mocked(Purchase.findOne).mockResolvedValue(null);

      const result =
        await CoOrganizerProgramAccessService.validateCoOrganizerAccess(
          organizers,
          [programId.toString()]
        );

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.status).toBe(403);
      expect(result.error?.message).toContain("John Doe");
      expect(result.error?.message).toContain("do not have access");
      expect(result.error?.data?.unauthorizedCoOrganizers).toEqual([
        { userId: userId.toString(), name: "John Doe" },
      ]);
    });

    it("should handle multiple co-organizers with mixed access", async () => {
      const programId = new mongoose.Types.ObjectId();
      const user1Id = new mongoose.Types.ObjectId();
      const user2Id = new mongoose.Types.ObjectId();
      const user3Id = new mongoose.Types.ObjectId();

      const organizers = [
        { userId: user1Id.toString(), name: "John Doe" }, // Has access (mentor)
        { userId: user2Id.toString(), name: "Jane Smith" }, // Has access (purchase)
        { userId: user3Id.toString(), name: "Bob Wilson" }, // No access
      ];

      // Mock Program.find to return paid program with user1 as mentor
      vi.mocked(Program.find).mockReturnValue({
        select: vi.fn().mockResolvedValue([
          {
            _id: programId,
            isFree: false,
            mentors: [{ userId: user1Id }],
          },
        ]),
      } as any);

      // Mock Purchase.findOne to return purchase for user2 only
      // Note: The first call is for user1 (mentor, so no purchase check needed but still called)
      // The actual logic stops early for mentors, but we account for both users here
      let callCount = 0;
      vi.mocked(Purchase.findOne).mockImplementation(() => {
        callCount++;
        // user1 is a mentor, so logic doesn't check purchase (but mock is called)
        // user2 is NOT a mentor, so check purchase - return success
        // user3 is NOT a mentor, so check purchase - return null
        if (callCount === 1) {
          // For user2 (second organizer checked, first to actually query purchase since user1 is mentor)
          return Promise.resolve({
            userId: user2Id,
            programId: programId,
            status: "completed",
          }) as any;
        }
        // For user3 (third organizer)
        return Promise.resolve(null) as any;
      });

      const result =
        await CoOrganizerProgramAccessService.validateCoOrganizerAccess(
          organizers,
          [programId.toString()]
        );

      expect(result.valid).toBe(false);
      expect(result.error?.data?.unauthorizedCoOrganizers).toHaveLength(1);
      expect(result.error?.data?.unauthorizedCoOrganizers[0].name).toBe(
        "Bob Wilson"
      );
    });

    it("should handle multiple programs (OR logic - access to at least one)", async () => {
      const program1Id = new mongoose.Types.ObjectId();
      const program2Id = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();

      const organizers = [{ userId: userId.toString(), name: "John Doe" }];

      // Mock Program.find to return two paid programs
      vi.mocked(Program.find).mockReturnValue({
        select: vi.fn().mockResolvedValue([
          {
            _id: program1Id,
            isFree: false,
            mentors: [],
          },
          {
            _id: program2Id,
            isFree: false,
            mentors: [],
          },
        ]),
      } as any);

      // Mock Purchase.findOne to return purchase for program2 only
      let callCount = 0;
      vi.mocked(Purchase.findOne).mockImplementation(() => {
        callCount++;
        // First call is for program1 (no purchase), second call is for program2 (has purchase)
        if (callCount === 2) {
          return Promise.resolve({
            userId: userId,
            programId: program2Id,
            status: "completed",
          }) as any;
        }
        return Promise.resolve(null) as any;
      });

      const result =
        await CoOrganizerProgramAccessService.validateCoOrganizerAccess(
          organizers,
          [program1Id.toString(), program2Id.toString()]
        );

      // Should pass because user has access to at least one program (program2)
      expect(result.valid).toBe(true);
    });

    it("should handle mixed free and paid programs", async () => {
      const freeProgramId = new mongoose.Types.ObjectId();
      const paidProgramId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();

      const organizers = [{ userId: userId.toString(), name: "John Doe" }];

      // Mock Program.find to return one free and one paid program
      vi.mocked(Program.find).mockReturnValue({
        select: vi.fn().mockResolvedValue([
          {
            _id: freeProgramId,
            isFree: true,
            mentors: [],
          },
          {
            _id: paidProgramId,
            isFree: false,
            mentors: [],
          },
        ]),
      } as any);

      // Mock Purchase.findOne - user has not purchased
      vi.mocked(Purchase.findOne).mockResolvedValue(null);

      const result =
        await CoOrganizerProgramAccessService.validateCoOrganizerAccess(
          organizers,
          [freeProgramId.toString(), paidProgramId.toString()]
        );

      // Should fail because user doesn't have access to the paid program
      expect(result.valid).toBe(false);
    });

    it("should skip organizers without userId", async () => {
      const programId = new mongoose.Types.ObjectId();
      const organizers = [
        { name: "John Doe" }, // No userId
        { userId: "", name: "Jane Smith" }, // Empty userId
      ];

      // Mock Program.find to return paid program
      vi.mocked(Program.find).mockReturnValue({
        select: vi.fn().mockResolvedValue([
          {
            _id: programId,
            isFree: false,
            mentors: [],
          },
        ]),
      } as any);

      const result =
        await CoOrganizerProgramAccessService.validateCoOrganizerAccess(
          organizers,
          [programId.toString()]
        );

      // Should pass because all organizers without userId are skipped
      expect(result.valid).toBe(true);
    });

    it("should handle invalid program IDs gracefully", async () => {
      const organizers = [{ userId: "user1", name: "John Doe" }];

      // Mock Program.find to return empty array (no valid programs found)
      vi.mocked(Program.find).mockReturnValue({
        select: vi.fn().mockResolvedValue([]),
      } as any);

      const result =
        await CoOrganizerProgramAccessService.validateCoOrganizerAccess(
          organizers,
          ["invalid-id", "another-invalid"]
        );

      // Should pass because no valid programs means no paid program restrictions
      expect(result.valid).toBe(true);
    });

    it("should provide user-friendly error message with all unauthorized names", async () => {
      const programId = new mongoose.Types.ObjectId();
      const user1Id = new mongoose.Types.ObjectId();
      const user2Id = new mongoose.Types.ObjectId();

      const organizers = [
        { userId: user1Id.toString(), name: "John Doe" },
        { userId: user2Id.toString(), name: "Jane Smith" },
      ];

      // Mock Program.find to return paid program
      vi.mocked(Program.find).mockReturnValue({
        select: vi.fn().mockResolvedValue([
          {
            _id: programId,
            isFree: false,
            mentors: [],
          },
        ]),
      } as any);

      // Mock Purchase.findOne to return no purchases
      vi.mocked(Purchase.findOne).mockResolvedValue(null);

      const result =
        await CoOrganizerProgramAccessService.validateCoOrganizerAccess(
          organizers,
          [programId.toString()]
        );

      expect(result.valid).toBe(false);
      expect(result.error?.message).toContain("John Doe, Jane Smith");
      expect(result.error?.message).toContain("must be enrolled");
    });
  });
});
