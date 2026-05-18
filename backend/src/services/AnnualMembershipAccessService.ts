import mongoose from "mongoose";
import { AnnualMembership, Purchase } from "../models";

function toObjectIds(
  ids: Array<string | mongoose.Types.ObjectId | unknown>,
): mongoose.Types.ObjectId[] {
  return ids
    .map((id) => String(id))
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
}

export async function findMembershipIdsForPrograms(
  programIds: Array<string | mongoose.Types.ObjectId | unknown>,
): Promise<mongoose.Types.ObjectId[]> {
  const ids = toObjectIds(programIds);
  if (ids.length === 0) return [];

  const memberships = await AnnualMembership.find({
    programs: { $in: ids },
    isActive: true,
  }).select("_id");

  return memberships.map(
    (membership) => membership._id as mongoose.Types.ObjectId,
  );
}

export async function hasAnnualMembershipAccessToPrograms(params: {
  userId: string | mongoose.Types.ObjectId | unknown;
  programIds: Array<string | mongoose.Types.ObjectId | unknown>;
}): Promise<boolean> {
  const userId = String(params.userId);
  if (!mongoose.Types.ObjectId.isValid(userId)) return false;

  const membershipIds = await findMembershipIdsForPrograms(params.programIds);
  if (membershipIds.length === 0) return false;

  const purchase = await Purchase.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    purchaseType: "membership",
    membershipId: { $in: membershipIds },
    status: "completed",
    unenrolledAt: { $exists: false },
  }).select("_id");

  return !!purchase;
}

export async function hasAnnualMembershipAccessToProgram(params: {
  userId: string | mongoose.Types.ObjectId | unknown;
  programId: string | mongoose.Types.ObjectId | unknown;
}): Promise<boolean> {
  return hasAnnualMembershipAccessToPrograms({
    userId: params.userId,
    programIds: [params.programId],
  });
}
