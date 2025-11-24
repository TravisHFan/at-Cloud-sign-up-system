import { Request, Response } from "express";
import Purchase from "../../models/Purchase";

/**
 * PurchasePendingController
 * Handles user's pending purchases with auto-cleanup
 */
class PurchasePendingController {
  /**
   * Get user's pending purchases with auto-cleanup of expired sessions
   * GET /api/purchases/my-pending-purchases
   */
  static async getMyPendingPurchases(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }

      // Auto-cleanup 1: Delete pending purchases older than 24 hours (Stripe session expiration)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const expiredCleanupResult = await Purchase.deleteMany({
        userId: req.user._id,
        status: "pending",
        createdAt: { $lt: twentyFourHoursAgo },
      });

      if (expiredCleanupResult.deletedCount > 0) {
        console.log(
          `Auto-cleaned ${expiredCleanupResult.deletedCount} expired pending purchases for user ${req.user._id}`
        );
      }

      // Fetch remaining pending purchases
      const pendingPurchases = await Purchase.find({
        userId: req.user._id,
        status: "pending",
      })
        .populate("programId", "title programType")
        .populate("eventId", "title date")
        .sort({ createdAt: -1 });

      // Auto-cleanup 2: Remove pending purchases that are already completed
      const redundantPurchaseIds: string[] = [];
      for (const pending of pendingPurchases) {
        let existingCompletedPurchase = null;

        if (pending.purchaseType === "program" && pending.programId) {
          const programId = (pending.programId as { _id: unknown })._id;
          existingCompletedPurchase = await Purchase.findOne({
            userId: req.user._id,
            programId: programId,
            status: "completed",
          });
        } else if (pending.purchaseType === "event" && pending.eventId) {
          const eventId = (pending.eventId as { _id: unknown })._id;
          existingCompletedPurchase = await Purchase.findOne({
            userId: req.user._id,
            eventId: eventId,
            status: "completed",
          });
        }

        if (existingCompletedPurchase) {
          redundantPurchaseIds.push(pending._id.toString());
        }
      }

      if (redundantPurchaseIds.length > 0) {
        const redundantCleanupResult = await Purchase.deleteMany({
          _id: { $in: redundantPurchaseIds },
        });
        console.log(
          `Auto-cleaned ${redundantCleanupResult.deletedCount} redundant pending purchases (already purchased items) for user ${req.user._id}`
        );

        // Re-fetch pending purchases after redundant cleanup
        const updatedPendingPurchases = await Purchase.find({
          userId: req.user._id,
          status: "pending",
        })
          .populate("programId", "title programType")
          .populate("eventId", "title date")
          .sort({ createdAt: -1 });

        res.status(200).json({
          success: true,
          data: updatedPendingPurchases,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: pendingPurchases,
      });
    } catch (error) {
      console.error("Error fetching pending purchases:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch pending purchases.",
      });
    }
  }
}

export default PurchasePendingController;
