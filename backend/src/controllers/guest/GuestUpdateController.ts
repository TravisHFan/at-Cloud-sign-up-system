/**
 * GuestUpdateController.ts
 * Handles guest registration update operations
 */
import type { Request, Response } from "express";
import { GuestRegistration } from "../../models";
import { createLogger } from "../../services/LoggerService";
import { CorrelatedLogger } from "../../services/CorrelatedLogger";
import { socketService } from "../../services/infrastructure/SocketService";

/**
 * Controller for handling guest registration update operations
 */
class GuestUpdateController {
  private static readonly log = createLogger("GuestUpdateController");

  /**
   * Update guest registration details
   * PUT /api/guest-registrations/:id
   */
  static async updateGuestRegistration(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const params = req.params as Partial<Record<"guestId" | "id", string>>;
      const id = params.guestId || params.id;
      if (!id) {
        res
          .status(400)
          .json({ success: false, message: "Missing guest registration id" });
        return;
      }
      const { fullName, phone, notes } = req.body;

      const guestRegistration = await GuestRegistration.findById(id);

      if (!guestRegistration) {
        res.status(404).json({
          success: false,
          message: "Guest registration not found",
        });
        return;
      }

      if (guestRegistration.status === "cancelled") {
        res.status(400).json({
          success: false,
          message: "Cannot update cancelled registration",
        });
        return;
      }

      // Update allowed fields
      if (fullName) guestRegistration.fullName = fullName.trim();
      // Phone is optional and can be cleared by providing an empty string
      if (Object.prototype.hasOwnProperty.call(req.body || {}, "phone")) {
        const normalizedPhone =
          typeof phone === "string"
            ? phone.trim()
            : (phone as string | undefined);
        guestRegistration.phone =
          normalizedPhone && normalizedPhone.length > 0
            ? normalizedPhone
            : (undefined as unknown as string);
      }
      if (notes !== undefined) guestRegistration.notes = notes?.trim();

      await guestRegistration.save();

      // Emit WebSocket update so connected clients can refresh
      try {
        socketService.emitEventUpdate(
          guestRegistration.eventId.toString(),
          "guest_updated",
          {
            eventId: guestRegistration.eventId.toString(),
            roleId: guestRegistration.roleId,
            guestName: guestRegistration.fullName,
            timestamp: new Date(),
          }
        );
      } catch (socketError) {
        console.error("Failed to emit guest update:", socketError);
        try {
          CorrelatedLogger.fromRequest(req, "GuestUpdateController").error(
            "Failed to emit guest update",
            socketError as Error,
            undefined,
            { id }
          );
        } catch {
          /* ignore */
        }
      }

      res.status(200).json({
        success: true,
        message: "Guest registration updated successfully",
        data: guestRegistration.toPublicJSON(),
      });
    } catch (error) {
      console.error("Error updating guest registration:", error);
      GuestUpdateController.log.error(
        "Error updating guest registration",
        error as Error,
        undefined,
        { id: (req.params || {}).id }
      );
      try {
        CorrelatedLogger.fromRequest(req, "GuestUpdateController").error(
          "Error updating guest registration",
          error as Error,
          undefined,
          { id: (req.params || {}).id }
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

export default GuestUpdateController;
