import { Request, Response } from "express";
import mongoose from "mongoose";
import { Purchase, Program } from "../../models";

/**
 * PurchaseAccessController
 * Handles checking program access for users
 */
class PurchaseAccessController {
  /**
   * Check if user has access to a program
   * GET /api/purchases/check-access/:programId
   */
  static async checkProgramAccess(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }

      const { programId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(programId)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid program ID." });
        return;
      }

      const program = await Program.findById(programId);
      if (!program) {
        res.status(404).json({ success: false, message: "Program not found." });
        return;
      }

      // Super Admin and Administrator have access to all programs
      if (
        req.user.role === "Super Admin" ||
        req.user.role === "Administrator"
      ) {
        res.status(200).json({
          success: true,
          data: { hasAccess: true, reason: "admin" },
        });
        return;
      }

      // Check if user is a mentor of this program
      const isMentor = program.mentors?.some(
        (mentor: { userId: mongoose.Types.ObjectId }) =>
          mentor.userId.toString() ===
          (req.user!._id as mongoose.Types.ObjectId).toString()
      );
      if (isMentor) {
        res.status(200).json({
          success: true,
          data: { hasAccess: true, reason: "mentor" },
        });
        return;
      }

      // Check if program is free
      if (program.isFree) {
        res.status(200).json({
          success: true,
          data: { hasAccess: true, reason: "free" },
        });
        return;
      }

      // Check if user has purchased the program
      const purchase = await Purchase.findOne({
        userId: req.user._id,
        programId: program._id,
        status: "completed",
      });

      if (purchase) {
        res.status(200).json({
          success: true,
          data: { hasAccess: true, reason: "purchased" },
        });
        return;
      }

      // No access
      res.status(200).json({
        success: true,
        data: { hasAccess: false, reason: "not_purchased" },
      });
    } catch (error) {
      console.error("Error checking program access:", error);
      res.status(500).json({
        success: false,
        message: "Failed to check program access.",
      });
    }
  }
}

export default PurchaseAccessController;
