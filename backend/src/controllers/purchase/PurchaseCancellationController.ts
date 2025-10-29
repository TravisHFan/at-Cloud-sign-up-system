import { Request, Response } from "express";
import mongoose from "mongoose";
import { Purchase, Program } from "../../models";

/**
 * PurchaseCancellationController
 * Handles cancelling pending purchases
 */
class PurchaseCancellationController {
  /**
   * Cancel a pending purchase
   * DELETE /api/purchases/:id
   * Only allows deleting pending purchases
   */
  static async cancelPendingPurchase(
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

      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid purchase ID." });
        return;
      }

      const purchase = await Purchase.findById(id);

      if (!purchase) {
        res
          .status(404)
          .json({ success: false, message: "Purchase not found." });
        return;
      }

      // Verify ownership
      if (
        purchase.userId.toString() !==
        (req.user._id as mongoose.Types.ObjectId).toString()
      ) {
        res.status(403).json({
          success: false,
          message: "You can only cancel your own purchases.",
        });
        return;
      }

      // Only allow deleting pending purchases
      if (purchase.status !== "pending") {
        res.status(400).json({
          success: false,
          message: `Cannot cancel a ${purchase.status} purchase. Only pending purchases can be cancelled.`,
        });
        return;
      }

      // If this was a Class Rep purchase, decrement the counter
      if (purchase.isClassRep) {
        await Program.findByIdAndUpdate(
          purchase.programId,
          { $inc: { classRepCount: -1 } },
          { runValidators: false } // Allow going below limit on decrement
        );
        console.log(
          `Decremented classRepCount for program ${purchase.programId}`
        );
      }

      await Purchase.findByIdAndDelete(id);

      console.log(`Cancelled pending purchase ${purchase.orderNumber}`);

      res.status(200).json({
        success: true,
        message: "Pending purchase cancelled successfully.",
      });
    } catch (error) {
      console.error("Error cancelling purchase:", error);
      res.status(500).json({
        success: false,
        message: "Failed to cancel purchase.",
      });
    }
  }
}

export default PurchaseCancellationController;
