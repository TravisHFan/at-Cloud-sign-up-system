/**
 * GuestTokenCancellationController.ts
 * Handles guest self-cancellation operations via manage token
 */
import type { Request, Response } from "express";
import * as crypto from "crypto";
import { GuestRegistration } from "../../models";
import { createLogger } from "../../services/LoggerService";
import { socketService } from "../../services/infrastructure/SocketService";

/**
 * Controller for handling guest self-cancellation operations via manage token
 */
class GuestTokenCancellationController {
  private static readonly log = createLogger(
    "GuestTokenCancellationController"
  );

  /**
   * Helper: verify and fetch guest registration by manage token
   */
  private static async findByManageToken(token: string) {
    if (!token) return null;
    const hashed = crypto.createHash("sha256").update(token).digest("hex");
    const now = new Date();
    return GuestRegistration.findOne({
      manageToken: hashed,
      manageTokenExpires: { $gt: now },
      status: { $ne: "cancelled" },
    });
  }

  /**
   * Cancel guest registration by token
   * DELETE /api/guest/manage/:token
   */
  static async cancelByToken(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params as { token: string };
      // For idempotence, first try to locate the document by token regardless of status,
      // then handle already-cancelled with a 400 response instead of 404.
      let doc = await GuestTokenCancellationController.findByManageToken(token);
      if (!doc) {
        try {
          const hashed = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");
          const now = new Date();
          doc = await GuestRegistration.findOne({
            manageToken: hashed,
            manageTokenExpires: { $gt: now },
          });
        } catch {
          /* intentionally ignore non-critical debug/logging errors */
        }
      }
      if (!doc) {
        res
          .status(404)
          .json({ success: false, message: "Invalid or expired link" });
        return;
      }
      // Capture details then delete the registration
      const eventId = doc.eventId.toString();
      const roleId = doc.roleId;
      const guestName = doc.fullName;
      await GuestRegistration.deleteOne({ _id: doc._id });
      try {
        socketService.emitEventUpdate(eventId, "guest_cancellation", {
          eventId,
          roleId,
          guestName,
          timestamp: new Date(),
        });
      } catch {
        // ignore
      }
      res.status(200).json({
        success: true,
        message: "Guest registration cancelled successfully",
      });
    } catch (error) {
      console.error("Error cancelling guest by token:", error);
      GuestTokenCancellationController.log.error(
        "Error cancelling guest by token",
        error as Error,
        undefined,
        { token: (req.params || {}).token }
      );
      res.status(500).json({
        success: false,
        message: "Failed to cancel guest registration",
      });
    }
  }
}

export default GuestTokenCancellationController;
