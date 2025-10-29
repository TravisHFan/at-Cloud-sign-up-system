import { Request, Response } from "express";
import mongoose from "mongoose";
import Purchase from "../../models/Purchase";
import { IProgram } from "../../models/Program";

/**
 * PurchaseRetrievalController
 * Handles retrieving individual purchase details
 */
class PurchaseRetrievalController {
  /**
   * Get a specific purchase by ID
   * GET /api/purchases/:id
   */
  static async getPurchaseById(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }

      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid purchase ID." });
        return;
      }

      const purchase = await Purchase.findById(id).populate(
        "programId",
        "title programType hostedBy mentors"
      );

      if (!purchase) {
        res
          .status(404)
          .json({ success: false, message: "Purchase not found." });
        return;
      }

      // Admins can view any purchase
      const isAdmin =
        req.user.role === "Super Admin" || req.user.role === "Administrator";

      // Check if user is a mentor of this program
      const program = purchase.programId as unknown as IProgram;
      const isMentor = program.mentors?.some(
        (mentor: { userId: mongoose.Types.ObjectId }) =>
          mentor.userId.toString() ===
          (req.user!._id as mongoose.Types.ObjectId).toString()
      );

      // Check if user is the purchase owner
      const isOwner =
        purchase.userId.toString() ===
        (req.user._id as mongoose.Types.ObjectId).toString();

      // Allow access if user is owner, admin, or mentor
      if (!isOwner && !isAdmin && !isMentor) {
        res.status(403).json({ success: false, message: "Access denied." });
        return;
      }

      res.status(200).json({
        success: true,
        data: purchase,
      });
    } catch (error) {
      console.error("Error fetching purchase:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch purchase.",
      });
    }
  }
}

export default PurchaseRetrievalController;
