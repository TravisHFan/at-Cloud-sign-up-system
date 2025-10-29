/**
 * GuestTokenRetrievalController.ts
 * Handles guest registration retrieval via manage token
 */
import type { Request, Response } from "express";
import * as crypto from "crypto";
import { GuestRegistration } from "../../models";
import { createLogger } from "../../services/LoggerService";
import { CorrelatedLogger } from "../../services/CorrelatedLogger";

/**
 * Controller for handling guest registration retrieval via manage token
 */
class GuestTokenRetrievalController {
  private static readonly log = createLogger("GuestTokenRetrievalController");

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
   * Get guest registration by token
   * GET /api/guest/manage/:token
   */
  static async getGuestByToken(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params as { token: string };
      const doc = await GuestTokenRetrievalController.findByManageToken(token);
      if (!doc) {
        res
          .status(404)
          .json({ success: false, message: "Invalid or expired link" });
        return;
      }
      res
        .status(200)
        .json({ success: true, data: { guest: doc.toPublicJSON() } });
    } catch (error) {
      console.error("Error fetching guest by token:", error);
      GuestTokenRetrievalController.log.error(
        "Error fetching guest by token",
        error as Error,
        undefined,
        { token: (req.params || {}).token }
      );
      try {
        CorrelatedLogger.fromRequest(
          req,
          "GuestTokenRetrievalController"
        ).error("Error fetching guest by token", error as Error, undefined, {
          token: (req.params || {}).token,
        });
      } catch {
        /* ignore */
      }
      res.status(500).json({
        success: false,
        message: "Failed to fetch guest registration",
      });
    }
  }
}

export default GuestTokenRetrievalController;
