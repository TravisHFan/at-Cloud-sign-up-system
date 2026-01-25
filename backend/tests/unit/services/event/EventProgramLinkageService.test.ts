import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

// Mock dependencies
vi.mock("../../../../src/models", () => ({
  Program: {
    findById: vi.fn(),
    updateOne: vi.fn(),
  },
  Purchase: {
    findOne: vi.fn(),
  },
}));

import { EventProgramLinkageService } from "../../../../src/services/event/EventProgramLinkageService";
import { Program, Purchase } from "../../../../src/models";

describe("EventProgramLinkageService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validateAndLinkPrograms", () => {
    const mockUser = { _id: "user-123", role: "Leader" };
    const adminUser = { _id: "admin-123", role: "Admin" };
    const validProgramId1 = "507f191e810c19729de860ea";
    const validProgramId2 = "507f191e810c19729de860eb";

    it("returns empty result when rawProgramLabels is not an array", async () => {
      const result = await EventProgramLinkageService.validateAndLinkPrograms(
        null,
        mockUser,
      );

      expect(result.valid).toBe(true);
      expect(result.validatedProgramLabels).toEqual([]);
      expect(result.linkedPrograms).toEqual([]);
    });

    it("returns empty result when rawProgramLabels is an empty array", async () => {
      const result = await EventProgramLinkageService.validateAndLinkPrograms(
        [],
        mockUser,
      );

      expect(result.valid).toBe(true);
      expect(result.validatedProgramLabels).toEqual([]);
      expect(result.linkedPrograms).toEqual([]);
    });

    it("returns empty result when rawProgramLabels is undefined", async () => {
      const result = await EventProgramLinkageService.validateAndLinkPrograms(
        undefined,
        mockUser,
      );

      expect(result.valid).toBe(true);
      expect(result.validatedProgramLabels).toEqual([]);
      expect(result.linkedPrograms).toEqual([]);
    });

    it("filters out null, undefined, 'none', and empty string values", async () => {
      (Program.findById as ReturnType<typeof vi.fn>).mockImplementation(
        (id: string) => ({
          select: vi.fn().mockResolvedValue({ _id: id, isFree: true }),
        }),
      );

      const result = await EventProgramLinkageService.validateAndLinkPrograms(
        [null, undefined, "none", "", validProgramId1, "  "],
        mockUser,
      );

      expect(result.valid).toBe(true);
      expect(result.validatedProgramLabels).toHaveLength(1);
      expect(result.validatedProgramLabels?.[0]?.toHexString()).toBe(
        validProgramId1,
      );
    });

    it("deduplicates program IDs", async () => {
      (Program.findById as ReturnType<typeof vi.fn>).mockImplementation(
        (id: string) => ({
          select: vi.fn().mockResolvedValue({ _id: id, isFree: true }),
        }),
      );

      const result = await EventProgramLinkageService.validateAndLinkPrograms(
        [validProgramId1, validProgramId1, validProgramId1],
        mockUser,
      );

      expect(result.valid).toBe(true);
      expect(result.validatedProgramLabels).toHaveLength(1);
      expect(Program.findById).toHaveBeenCalledTimes(1);
    });

    it("returns error for invalid ObjectId format", async () => {
      const result = await EventProgramLinkageService.validateAndLinkPrograms(
        ["not-a-valid-objectid"],
        mockUser,
      );

      expect(result.valid).toBe(false);
      expect(result.error?.status).toBe(400);
      expect(result.error?.message).toContain("Invalid program ID");
    });

    it("returns error when program is not found", async () => {
      (Program.findById as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      });

      const result = await EventProgramLinkageService.validateAndLinkPrograms(
        [validProgramId1],
        mockUser,
      );

      expect(result.valid).toBe(false);
      expect(result.error?.status).toBe(400);
      expect(result.error?.message).toContain("Program not found");
    });

    it("succeeds for Admin user without access validation", async () => {
      (Program.findById as ReturnType<typeof vi.fn>).mockImplementation(
        (id: string) => ({
          select: vi.fn().mockResolvedValue({
            _id: id,
            isFree: false, // Not free, but Admin should still pass
            mentors: [],
          }),
        }),
      );

      const result = await EventProgramLinkageService.validateAndLinkPrograms(
        [validProgramId1],
        adminUser,
      );

      expect(result.valid).toBe(true);
      expect(result.validatedProgramLabels).toHaveLength(1);
      // Purchase.findOne should NOT be called for admin
      expect(Purchase.findOne).not.toHaveBeenCalled();
    });

    it("allows Leader access to free programs", async () => {
      (Program.findById as ReturnType<typeof vi.fn>).mockImplementation(
        (id: string) => ({
          select: vi.fn().mockResolvedValue({ _id: id, isFree: true }),
        }),
      );

      const result = await EventProgramLinkageService.validateAndLinkPrograms(
        [validProgramId1],
        mockUser,
      );

      expect(result.valid).toBe(true);
      expect(Purchase.findOne).not.toHaveBeenCalled();
    });

    it("allows Leader access when user is a mentor", async () => {
      (Program.findById as ReturnType<typeof vi.fn>).mockImplementation(
        (id: string) => ({
          select: vi.fn().mockResolvedValue({
            _id: id,
            isFree: false,
            mentors: [{ userId: mockUser._id }],
          }),
        }),
      );

      const result = await EventProgramLinkageService.validateAndLinkPrograms(
        [validProgramId1],
        mockUser,
      );

      expect(result.valid).toBe(true);
      expect(Purchase.findOne).not.toHaveBeenCalled();
    });

    it("allows Leader access when user has purchased the program", async () => {
      (Program.findById as ReturnType<typeof vi.fn>).mockImplementation(
        (id: string) => ({
          select: vi.fn().mockResolvedValue({
            _id: id,
            isFree: false,
            mentors: [],
          }),
        }),
      );
      (Purchase.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({
        _id: "purchase-123",
        status: "completed",
      });

      const result = await EventProgramLinkageService.validateAndLinkPrograms(
        [validProgramId1],
        mockUser,
      );

      expect(result.valid).toBe(true);
      expect(Purchase.findOne).toHaveBeenCalledWith({
        userId: mockUser._id,
        programId: validProgramId1,
        status: "completed",
      });
    });

    it("denies Leader access when user has no access to paid program", async () => {
      (Program.findById as ReturnType<typeof vi.fn>).mockImplementation(
        (id: string) => ({
          select: vi.fn().mockResolvedValue({
            _id: id,
            isFree: false,
            mentors: [],
          }),
        }),
      );
      (Purchase.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await EventProgramLinkageService.validateAndLinkPrograms(
        [validProgramId1],
        mockUser,
      );

      expect(result.valid).toBe(false);
      expect(result.error?.status).toBe(403);
      expect(result.error?.message).toContain(
        "You can only associate programs that you have access to",
      );
      expect(result.error?.data).toMatchObject({
        programId: validProgramId1,
        reason: "no_access",
      });
    });

    it("validates multiple programs and fails on first unauthorized", async () => {
      const freeProgramId = validProgramId1;
      const paidProgramId = validProgramId2;

      (Program.findById as ReturnType<typeof vi.fn>).mockImplementation(
        (id: string) => {
          if (id === freeProgramId) {
            return {
              select: vi.fn().mockResolvedValue({ _id: id, isFree: true }),
            };
          }
          return {
            select: vi.fn().mockResolvedValue({
              _id: id,
              isFree: false,
              mentors: [],
            }),
          };
        },
      );
      (Purchase.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await EventProgramLinkageService.validateAndLinkPrograms(
        [freeProgramId, paidProgramId],
        mockUser,
      );

      expect(result.valid).toBe(false);
      expect((result.error?.data as any)?.programId).toBe(paidProgramId);
    });

    it("returns validated ObjectIds and linked programs on success", async () => {
      (Program.findById as ReturnType<typeof vi.fn>).mockImplementation(
        (id: string) => ({
          select: vi.fn().mockResolvedValue({
            _id: id,
            programType: "Course",
            isFree: true,
          }),
        }),
      );

      const result = await EventProgramLinkageService.validateAndLinkPrograms(
        [validProgramId1, validProgramId2],
        mockUser,
      );

      expect(result.valid).toBe(true);
      expect(result.validatedProgramLabels).toHaveLength(2);
      expect(result.validatedProgramLabels?.[0]).toBeInstanceOf(
        mongoose.Types.ObjectId,
      );
      expect(result.linkedPrograms).toHaveLength(2);
    });
  });

  describe("linkEventToPrograms", () => {
    const eventId = new mongoose.Types.ObjectId();
    const programId1 = new mongoose.Types.ObjectId();
    const programId2 = new mongoose.Types.ObjectId();

    it("does nothing when linkedPrograms is empty", async () => {
      await EventProgramLinkageService.linkEventToPrograms(eventId, []);

      expect(Program.updateOne).not.toHaveBeenCalled();
    });

    it("adds event to each program's events array using $addToSet", async () => {
      (Program.updateOne as ReturnType<typeof vi.fn>).mockResolvedValue({
        modifiedCount: 1,
      });

      await EventProgramLinkageService.linkEventToPrograms(eventId, [
        { _id: programId1 },
        { _id: programId2 },
      ]);

      expect(Program.updateOne).toHaveBeenCalledTimes(2);
      expect(Program.updateOne).toHaveBeenCalledWith(
        { _id: programId1 },
        { $addToSet: { events: eventId } },
      );
      expect(Program.updateOne).toHaveBeenCalledWith(
        { _id: programId2 },
        { $addToSet: { events: eventId } },
      );
    });

    it("continues with other programs even if one update fails", async () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      (Program.updateOne as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error("DB error"))
        .mockResolvedValueOnce({ modifiedCount: 1 });

      await EventProgramLinkageService.linkEventToPrograms(eventId, [
        { _id: programId1 },
        { _id: programId2 },
      ]);

      expect(Program.updateOne).toHaveBeenCalledTimes(2);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to add event to program"),
        expect.any(Error),
      );

      consoleWarnSpy.mockRestore();
    });

    it("handles all updates failing gracefully", async () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      (Program.updateOne as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("DB error"),
      );

      // Should not throw
      await expect(
        EventProgramLinkageService.linkEventToPrograms(eventId, [
          { _id: programId1 },
          { _id: programId2 },
        ]),
      ).resolves.toBeUndefined();

      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
      consoleWarnSpy.mockRestore();
    });
  });
});
