import { Request, Response } from "express";
import mongoose from "mongoose";
import { Program, Purchase } from "../../models";
import { sanitizeMentors } from "../../utils/privacy";
import { normalizeProgramRoles } from "../../utils/programRoles";
import { hasAnnualMembershipAccessToProgram } from "../../services/AnnualMembershipAccessService";

type PopulatedMentorUser = {
  _id?: unknown;
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  gender?: "male" | "female";
  avatar?: string;
  roleInAtCloud?: string;
};

type ProgramMentor = {
  userId?: unknown;
  firstName?: string;
  lastName?: string;
  email?: string;
  gender?: "male" | "female";
  avatar?: string;
  roleInAtCloud?: string;
};

function isPopulatedMentorUser(value: unknown): value is PopulatedMentorUser {
  return (
    typeof value === "object" &&
    value !== null &&
    !(value instanceof mongoose.Types.ObjectId) &&
    ("_id" in value || "id" in value)
  );
}

function mentorUserIdToString(userId: unknown): string | undefined {
  if (!userId) return undefined;
  if (userId instanceof mongoose.Types.ObjectId) return userId.toString();
  if (isPopulatedMentorUser(userId)) {
    return userId.id || (userId._id ? String(userId._id) : undefined);
  }
  return String(userId);
}

function normalizeMentor(mentor: ProgramMentor): ProgramMentor {
  const liveUser = isPopulatedMentorUser(mentor.userId)
    ? mentor.userId
    : undefined;

  return {
    userId: mentorUserIdToString(mentor.userId),
    firstName: liveUser?.firstName ?? mentor.firstName,
    lastName: liveUser?.lastName ?? mentor.lastName,
    email: liveUser?.email ?? mentor.email,
    gender: liveUser?.gender ?? mentor.gender,
    avatar: liveUser?.avatar ?? mentor.avatar,
    roleInAtCloud: liveUser?.roleInAtCloud ?? mentor.roleInAtCloud,
  };
}

export default class RetrievalController {
  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid program ID." });
        return;
      }
      const program = await Program.findById(id);
      if (!program) {
        res.status(404).json({ success: false, message: "Program not found." });
        return;
      }

      if (typeof program.populate === "function") {
        await program.populate({
          path: "mentors.userId",
          select: "firstName lastName email gender avatar roleInAtCloud",
        });
      }

      // Determine if user can view mentor contact information:
      // - Super Admin and Administrator can always see contacts
      // - Program mentors can see contacts
      // - Enrolled users can see contacts
      // - Everyone else cannot see mentor contact info
      const user = req.user;
      const isAdmin =
        user?.role === "Super Admin" || user?.role === "Administrator";
      const isMentor = program.mentors?.some(
        (mentor: { userId: unknown }) =>
          mentorUserIdToString(mentor.userId) === String(user?._id),
      );

      // Check enrollment status
      let isEnrolled = false;
      if (user && !isAdmin && !isMentor) {
        const purchase = await Purchase.findOne({
          userId: user._id,
          programId: program._id,
          purchaseType: "program",
          status: "completed",
          unenrolledAt: { $exists: false },
        });
        const isAdminEnrolled =
          program.adminEnrollments?.mentees?.some(
            (id: mongoose.Types.ObjectId) => id.toString() === String(user._id),
          ) ||
          program.adminEnrollments?.classReps?.some(
            (id: mongoose.Types.ObjectId) => id.toString() === String(user._id),
          );
        const hasMembershipAccess = await hasAnnualMembershipAccessToProgram({
          userId: user._id,
          programId: program._id,
        });
        isEnrolled = !!purchase || !!isAdminEnrolled || hasMembershipAccess;
      }

      const canViewMentorContact = isAdmin || isMentor || isEnrolled;

      // Convert to plain object for sanitization (include virtuals for 'id' field)
      const programObj = program.toObject({ virtuals: true });
      programObj.programRoles = normalizeProgramRoles(programObj);

      if (programObj.mentors) {
        programObj.mentors = (programObj.mentors as ProgramMentor[]).map(
          normalizeMentor,
        );
      }

      // Sanitize mentor data if user cannot view contact info
      if (programObj.mentors) {
        programObj.mentors = sanitizeMentors(
          programObj.mentors,
          canViewMentorContact,
        );
      }

      res.status(200).json({ success: true, data: programObj });
    } catch {
      res
        .status(500)
        .json({ success: false, message: "Failed to get program." });
    }
  }
}
