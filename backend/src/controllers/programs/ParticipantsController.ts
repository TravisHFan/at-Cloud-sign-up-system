import { Request, Response } from "express";
import mongoose from "mongoose";
import { Program, Purchase, User } from "../../models";

export default class ParticipantsController {
  /**
   * Get all participants (mentees and class reps) for a program
   * Combines paid purchases and admin enrollments
   *
   * @route GET /programs/:id/participants
   * @returns {Object} Lists of mentees and classReps with user info and enrollment metadata
   */
  static async getParticipants(req: Request, res: Response): Promise<void> {
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

      // Get all completed purchases for this program
      const purchases = await Purchase.find({
        programId: id,
        status: "completed",
      })
        .populate<{
          userId: {
            _id: mongoose.Types.ObjectId;
            firstName: string;
            lastName: string;
            email: string;
            phone?: string;
            avatar?: string;
            gender?: string;
            roleInAtCloud?: string;
          };
        }>(
          "userId",
          "firstName lastName email phone avatar gender roleInAtCloud"
        )
        .sort({ purchaseDate: 1 }); // Sort by enrollment date

      // Separate mentees and class reps from purchases
      const paidMentees = purchases
        .filter((p) => !p.isClassRep)
        .map((p) => ({
          user: p.userId,
          isPaid: true,
          enrollmentDate: p.purchaseDate,
        }));

      const paidClassReps = purchases
        .filter((p) => p.isClassRep)
        .map((p) => ({
          user: p.userId,
          isPaid: true,
          enrollmentDate: p.purchaseDate,
        }));

      // Get admin enrollments
      const adminMenteeIds = program.adminEnrollments?.mentees || [];
      const adminClassRepIds = program.adminEnrollments?.classReps || [];

      const adminMentees = await User.find({
        _id: { $in: adminMenteeIds },
      }).select(
        "_id firstName lastName email phone avatar gender roleInAtCloud"
      );

      const adminClassReps = await User.find({
        _id: { $in: adminClassRepIds },
      }).select(
        "_id firstName lastName email phone avatar gender roleInAtCloud"
      );

      // Combine paid and admin enrollments (admins sorted to end for now, can adjust later)
      const allMentees = [
        ...paidMentees,
        ...adminMentees.map((user) => ({
          user,
          isPaid: false,
          enrollmentDate: program.updatedAt, // Use program updated date as proxy
        })),
      ];

      const allClassReps = [
        ...paidClassReps,
        ...adminClassReps.map((user) => ({
          user,
          isPaid: false,
          enrollmentDate: program.updatedAt,
        })),
      ];

      res.status(200).json({
        success: true,
        data: {
          mentees: allMentees,
          classReps: allClassReps,
        },
      });
    } catch (error) {
      console.error("Error fetching program participants:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch program participants.",
      });
    }
  }
}
