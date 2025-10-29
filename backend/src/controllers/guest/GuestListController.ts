/**
 * GuestListController.ts
 * Handles guest list retrieval operations
 */
import type { Request, Response } from "express";
import { GuestRegistration } from "../../models";
import { createLogger } from "../../services/LoggerService";
import { CorrelatedLogger } from "../../services/CorrelatedLogger";

/**
 * Controller for handling guest list retrieval operations
 */
class GuestListController {
  private static readonly log = createLogger("GuestListController");

  /**
   * Get guest registrations for an event
   * Admins receive full admin JSON; non-admins receive public JSON (no email/phone)
   * GET /api/events/:eventId/guests
   */
  static async getEventGuests(req: Request, res: Response): Promise<void> {
    try {
      const { eventId } = req.params;

      const guests = await GuestRegistration.findActiveByEvent(eventId);

      // Admins and Leaders can view guest contact info; others get sanitized public JSON
      const isPrivilegedViewer =
        !!req.user &&
        (req.userRole === "Super Admin" ||
          req.userRole === "Administrator" ||
          req.userRole === "Leader");

      res.status(200).json({
        success: true,
        data: {
          guests: guests.map((guest) =>
            isPrivilegedViewer ? guest.toAdminJSON() : guest.toPublicJSON()
          ),
          count: guests.length,
        },
      });
    } catch (error) {
      console.error("Error fetching event guests:", error);
      GuestListController.log.error(
        "Error fetching event guests",
        error as Error,
        undefined,
        { eventId: (req.params || {}).eventId }
      );
      try {
        CorrelatedLogger.fromRequest(req, "GuestListController").error(
          "Error fetching event guests",
          error as Error,
          undefined,
          { eventId: (req.params || {}).eventId }
        );
      } catch {
        /* ignore */
      }
      res.status(500).json({
        success: false,
        message: "Failed to fetch event guests",
      });
    }
  }
}

export default GuestListController;
