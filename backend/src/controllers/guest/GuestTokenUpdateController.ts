/**
 * GuestTokenUpdateController.ts
 * Handles guest self-update operations via manage token
 */
import type { Request, Response } from "express";
import * as crypto from "crypto";
import { GuestRegistration } from "../../models";
import { createLogger } from "../../services/LoggerService";
import { CorrelatedLogger } from "../../services/CorrelatedLogger";
import { socketService } from "../../services/infrastructure/SocketService";

/**
 * Controller for handling guest self-update operations via manage token
 */
class GuestTokenUpdateController {
  private static readonly log = createLogger("GuestTokenUpdateController");

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
   * Update guest registration by token
   * PUT /api/guest/manage/:token
   */
  static async updateByToken(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params as { token: string };
      const doc = await GuestTokenUpdateController.findByManageToken(token);
      if (!doc) {
        res
          .status(404)
          .json({ success: false, message: "Invalid or expired link" });
        return;
      }
      const { fullName, phone, notes } = req.body || {};
      if (fullName) doc.fullName = String(fullName).trim();
      // Phone is optional and can be cleared by providing an empty string
      if (Object.prototype.hasOwnProperty.call(req.body || {}, "phone")) {
        const normalizedPhone =
          typeof phone === "string"
            ? phone.trim()
            : (phone as string | undefined);
        doc.phone =
          normalizedPhone && normalizedPhone.length > 0
            ? normalizedPhone
            : (undefined as unknown as string);
      }
      if (notes !== undefined) doc.notes = String(notes ?? "").trim();
      // Rotate token after successful update to reduce replay window
      let newRawToken: string | undefined;
      try {
        newRawToken = (
          doc as unknown as { generateManageToken?: () => string | undefined }
        ).generateManageToken?.();
      } catch {
        /* ignore */
      }
      await doc.save();
      // Emit WebSocket update for parity with admin updates
      try {
        socketService.emitEventUpdate(doc.eventId.toString(), "guest_updated", {
          eventId: doc.eventId.toString(),
          roleId: doc.roleId,
          guestName: doc.fullName,
          timestamp: new Date(),
        });
      } catch {
        /* intentionally ignore non-critical debug/logging errors */
      }
      res.status(200).json({
        success: true,
        message: "Guest registration updated successfully",
        data: { ...doc.toPublicJSON(), manageToken: newRawToken },
      });
    } catch (error) {
      console.error("Error updating guest by token:", error);
      GuestTokenUpdateController.log.error(
        "Error updating guest by token",
        error as Error,
        undefined,
        { token: (req.params || {}).token }
      );
      try {
        CorrelatedLogger.fromRequest(req, "GuestTokenUpdateController").error(
          "Error updating guest by token",
          error as Error,
          undefined,
          { token: (req.params || {}).token }
        );
      } catch {
        /* ignore */
      }
      res.status(500).json({
        success: false,
        message: "Failed to update guest registration",
      });
    }
  }
}

export default GuestTokenUpdateController;
