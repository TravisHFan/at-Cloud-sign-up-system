import { Request, Response } from "express";
import mongoose from "mongoose";
import { Program, Purchase } from "../../models";
import { sanitizeMentors } from "../../utils/privacy";

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

      // Determine if user can view mentor contact information:
      // - Super Admin and Administrator can always see contacts
      // - Program mentors can see contacts
      // - Enrolled users (purchased or free program) can see contacts
      // - Everyone else cannot see mentor contact info
      const user = req.user;
      const isAdmin =
        user?.role === "Super Admin" || user?.role === "Administrator";
      const isMentor = program.mentors?.some(
        (mentor: { userId: mongoose.Types.ObjectId }) =>
          mentor.userId.toString() === String(user?._id),
      );

      // Check enrollment status
      let isEnrolled = false;
      if (user && !isAdmin && !isMentor) {
        // Check if program is free (all logged-in users have access)
        if (program.isFree) {
          isEnrolled = true;
        } else {
          // Check if user has purchased or is admin-enrolled
          const purchase = await Purchase.findOne({
            userId: user._id,
            programId: program._id,
            status: "completed",
          });
          const isAdminEnrolled =
            program.adminEnrollments?.mentees?.some(
              (id: mongoose.Types.ObjectId) =>
                id.toString() === String(user._id),
            ) ||
            program.adminEnrollments?.classReps?.some(
              (id: mongoose.Types.ObjectId) =>
                id.toString() === String(user._id),
            );
          isEnrolled = !!purchase || !!isAdminEnrolled;
        }
      }

      const canViewMentorContact = isAdmin || isMentor || isEnrolled;

      // Convert to plain object for sanitization (include virtuals for 'id' field)
      const programObj = program.toObject({ virtuals: true });

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
