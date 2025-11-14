import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";

vi.mock("../../../../src/models", () => ({
  Program: {
    findById: vi.fn(),
  },
  Purchase: {
    findOne: vi.fn(),
  },
}));

vi.mock("../../../../src/controllers/eventController", () => ({
  EventController: {
    toIdString: (id: any) => String(id),
  },
}));

import { ProgramLinkageService } from "../../../../src/services/event/ProgramLinkageService";
import { Program, Purchase } from "../../../../src/models";

describe("ProgramLinkageService.extractPreviousLabels", () => {
  it("returns empty array when programLabels is missing or not an array", () => {
    expect(ProgramLinkageService.extractPreviousLabels({})).toEqual([]);
    expect(
      ProgramLinkageService.extractPreviousLabels({
        programLabels: "not-array",
      })
    ).toEqual([]);
  });

  it("normalizes programLabels to string IDs via EventController.toIdString", () => {
    const labels = ProgramLinkageService.extractPreviousLabels({
      programLabels: [
        new mongoose.Types.ObjectId("507f191e810c19729de860ea"),
        "plain-id",
      ],
    });

    expect(labels).toEqual(["507f191e810c19729de860ea", "plain-id"]);
  });
});

describe("ProgramLinkageService.processAndValidate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("treats null or empty string as explicit clear", async () => {
    await expect(
      ProgramLinkageService.processAndValidate(null)
    ).resolves.toEqual({ success: true, programIds: [], linkedPrograms: [] });

    await expect(ProgramLinkageService.processAndValidate("")).resolves.toEqual(
      { success: true, programIds: [], linkedPrograms: [] }
    );
  });

  it("returns success with empty arrays when input is not an array", async () => {
    await expect(
      ProgramLinkageService.processAndValidate("not-array")
    ).resolves.toEqual({ success: true, programIds: [], linkedPrograms: [] });
  });

  it("filters invalid values, strips 'none', deduplicates, and validates IDs and existence", async () => {
    (Program.findById as any).mockImplementation((id: string) => {
      if (id === "507f191e810c19729de860ea") {
        return {
          select: vi.fn().mockResolvedValue({ _id: id, isFree: true }),
        };
      }
      if (id === "507f191e810c19729de860eb") {
        return {
          select: vi.fn().mockResolvedValue({ _id: id, isFree: false }),
        };
      }
      return {
        select: vi.fn().mockResolvedValue(null),
      };
    });

    const result = await ProgramLinkageService.processAndValidate([
      null,
      "",
      "none",
      " 507f191e810c19729de860ea ",
      "507f191e810c19729de860eb",
      "507f191e810c19729de860ea", // duplicate
    ]);

    expect(result.success).toBe(true);
    expect(result.programIds).toEqual([
      "507f191e810c19729de860ea",
      "507f191e810c19729de860eb",
    ]);
    expect(result.linkedPrograms).toHaveLength(2);
  });

  it("fails fast on invalid ObjectId", async () => {
    const result = await ProgramLinkageService.processAndValidate([
      "not-an-objectid",
    ]);

    expect(result.success).toBe(false);
    expect(result.error).toEqual({
      status: 400,
      message: "Invalid program ID: not-an-objectid",
    });
  });

  it("fails when program is not found", async () => {
    (Program.findById as any).mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    });

    const validId = "507f191e810c19729de860ea";
    const result = await ProgramLinkageService.processAndValidate([validId]);

    expect(result.success).toBe(false);
    expect(result.error).toEqual({
      status: 400,
      message: `Program not found: ${validId}`,
    });
  });

  it("allows Leader with access (free, mentor, or purchased) and denies without access", async () => {
    const freeProgramId = "507f191e810c19729de860ea";
    const mentorProgramId = "507f191e810c19729de860eb";
    const purchasedProgramId = "507f191e810c19729de860ec";
    const unauthorizedProgramId = "507f191e810c19729de860ed";

    (Program.findById as any).mockImplementation((id: string) => {
      const base = { select: vi.fn() };
      if (id === freeProgramId) {
        return {
          select: vi.fn().mockResolvedValue({ _id: id, isFree: true }),
        };
      }
      if (id === mentorProgramId) {
        return {
          select: vi.fn().mockResolvedValue({
            _id: id,
            isFree: false,
            mentors: [{ userId: "leader-1" }],
          }),
        };
      }
      if (id === purchasedProgramId) {
        return {
          select: vi.fn().mockResolvedValue({ _id: id, isFree: false }),
        };
      }
      if (id === unauthorizedProgramId) {
        return {
          select: vi.fn().mockResolvedValue({ _id: id, isFree: false }),
        };
      }
      return base;
    });

    (Purchase.findOne as any).mockImplementation((query: any) => {
      if (String(query.programId) === purchasedProgramId) {
        return Promise.resolve({ _id: "purchase-1" });
      }
      return Promise.resolve(null);
    });

    // First, try with an unauthorized program included - should fail
    const failResult = await ProgramLinkageService.processAndValidate(
      [
        freeProgramId,
        mentorProgramId,
        purchasedProgramId,
        unauthorizedProgramId,
      ],
      "leader-1",
      "Leader"
    );

    expect(failResult.success).toBe(false);
    expect(failResult.error?.status).toBe(403);
    expect(failResult.error?.data).toMatchObject({
      programId: unauthorizedProgramId,
      reason: "no_access",
    });

    // Now, without the unauthorized program - should succeed
    const okResult = await ProgramLinkageService.processAndValidate(
      [freeProgramId, mentorProgramId, purchasedProgramId],
      "leader-1",
      "Leader"
    );

    expect(okResult.success).toBe(true);
    expect(okResult.programIds).toEqual([
      freeProgramId,
      mentorProgramId,
      purchasedProgramId,
    ]);
  });
});

describe("ProgramLinkageService.toObjectIdArray", () => {
  it("converts string IDs to ObjectId instances", () => {
    const ids = ["507f191e810c19729de860ea", "507f191e810c19729de860eb"];
    const result = ProgramLinkageService.toObjectIdArray(ids);

    expect(result).toHaveLength(2);
    result.forEach((objId, idx) => {
      expect(objId).toBeInstanceOf(mongoose.Types.ObjectId);
      expect(objId.toHexString()).toBe(ids[idx]);
    });
  });
});
