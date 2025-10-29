/**
 * GuestRetrievalController.ts
 * Handles guest registration retrieval operations
 */
import type { Request, Response } from "express";
import { GuestRegistration } from "../../models";
import { createLogger } from "../../services/LoggerService";
import { CorrelatedLogger } from "../../services/CorrelatedLogger";

/**
 * Controller for handling guest registration retrieval operations
 */
class GuestRetrievalController {
  private static readonly log = createLogger("GuestRetrievalController");

  /**
   * Get guest registration by ID (for email links)
   * GET /api/guest-registrations/:id
   */
  static async getGuestRegistration(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;

      const guestRegistration = await GuestRegistration.findById(id);

      if (!guestRegistration) {
        res.status(404).json({
          success: false,
          message: "Guest registration not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: { guest: guestRegistration.toPublicJSON() },
      });
    } catch (error) {
      console.error("Error fetching guest registration:", error);
      GuestRetrievalController.log.error(
        "Error fetching guest registration",
        error as Error,
        undefined,
        { id: (req.params || {}).id }
      );
      try {
        CorrelatedLogger.fromRequest(req, "GuestRetrievalController").error(
          "Error fetching guest registration",
          error as Error,
          undefined,
          { id: (req.params || {}).id }
        );
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

export default GuestRetrievalController;
