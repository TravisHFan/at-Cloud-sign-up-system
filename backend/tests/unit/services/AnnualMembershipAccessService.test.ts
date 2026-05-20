import { beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";

vi.mock("../../../src/models", () => ({
  AnnualMembership: {
    find: vi.fn(),
  },
  Purchase: {
    findOne: vi.fn(),
  },
}));

import { AnnualMembership, Purchase } from "../../../src/models";
import {
  findMembershipIdsForPrograms,
  hasAnnualMembershipAccessToProgram,
  hasAnnualMembershipAccessToPrograms,
} from "../../../src/services/AnnualMembershipAccessService";

function mockSelect<T>(value: T) {
  return {
    select: vi.fn().mockResolvedValue(value),
  };
}

describe("AnnualMembershipAccessService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("grants access to a program added to a membership after the user purchased it", async () => {
    const userId = new mongoose.Types.ObjectId();
    const programAddedAfterPurchaseId = new mongoose.Types.ObjectId();
    const purchasedMembershipId = new mongoose.Types.ObjectId();

    vi.mocked(AnnualMembership.find).mockReturnValue(
      mockSelect([{ _id: purchasedMembershipId }]) as never,
    );
    vi.mocked(Purchase.findOne).mockReturnValue(
      mockSelect({ _id: new mongoose.Types.ObjectId() }) as never,
    );

    const hasAccess = await hasAnnualMembershipAccessToProgram({
      userId,
      programId: programAddedAfterPurchaseId,
    });

    expect(hasAccess).toBe(true);
    expect(AnnualMembership.find).toHaveBeenCalledWith({
      programs: { $in: [programAddedAfterPurchaseId] },
      isActive: true,
    });
    expect(Purchase.findOne).toHaveBeenCalledWith({
      userId,
      purchaseType: "membership",
      membershipId: { $in: [purchasedMembershipId] },
      status: "completed",
      unenrolledAt: { $exists: false },
    });
  });

  it("does not grant access when the user has no completed purchase for a current matching membership", async () => {
    const userId = new mongoose.Types.ObjectId();
    const programId = new mongoose.Types.ObjectId();
    const membershipId = new mongoose.Types.ObjectId();

    vi.mocked(AnnualMembership.find).mockReturnValue(
      mockSelect([{ _id: membershipId }]) as never,
    );
    vi.mocked(Purchase.findOne).mockReturnValue(mockSelect(null) as never);

    await expect(
      hasAnnualMembershipAccessToPrograms({
        userId,
        programIds: [programId],
      }),
    ).resolves.toBe(false);
  });

  it("returns no membership ids for invalid program ids", async () => {
    await expect(findMembershipIdsForPrograms(["not-an-id"])).resolves.toEqual(
      [],
    );
    expect(AnnualMembership.find).not.toHaveBeenCalled();
  });
});
