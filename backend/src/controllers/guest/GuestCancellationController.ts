/**
 * GuestCancellationController.ts
 * Handles guest registration cancellation operations
 */
import type { Request, Response } from "express";
import { GuestRegistration, Event, IEventRole } from "../../models";
import { createLogger } from "../../services/LoggerService";
import { CorrelatedLogger } from "../../services/CorrelatedLogger";
import { EmailService } from "../../services/infrastructure/EmailServiceFacade";
import { socketService } from "../../services/infrastructure/SocketService";

// Local types
type RequestWithUser = Request & { user?: { _id: unknown } };
type EventLike = { title: string; roles?: IEventRole[] };
type UserLike = { firstName?: string; lastName?: string };

/**
 * Controller for handling guest registration cancellation operations
 */
class GuestCancellationController {
  private static readonly log = createLogger("GuestCancellationController");

  /**
   * Cancel a guest registration
   * DELETE /api/guest-registrations/:id
   */
  static async cancelGuestRegistration(
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
      // reason in body is currently not used; request body preserved intentionally

      // Atomically delete the guest registration and get the document back
      const guestRegistration = await GuestRegistration.findById(id);

      if (!guestRegistration) {
        res.status(404).json({
          success: false,
          message: "Guest registration not found",
        });
        return;
      }
      // Preserve details for notifications prior to deletion
      const eventId = guestRegistration.eventId.toString();
      const roleId = guestRegistration.roleId;
      const guestName = guestRegistration.fullName;
      const guestEmail = guestRegistration.email;

      // Perform deletion (source of truth aligns with user registrations)
      await GuestRegistration.deleteOne({ _id: guestRegistration._id });

      // Proactively notify the guest that an organizer/admin removed them from the role
      try {
        const event = await Event.findById(eventId);
        // Resolve the role name for context; fallback gracefully
        const roleName =
          (event?.roles || []).find((r: IEventRole) => r?.id === roleId)
            ?.name ||
          (
            guestRegistration as unknown as {
              eventSnapshot?: { roleName?: string };
            }
          ).eventSnapshot?.roleName ||
          (
            guestRegistration as unknown as {
              eventSnapshot?: { roleName?: string };
            }
          ).eventSnapshot?.roleName ||
          "the role";
        const actor = (req as unknown as RequestWithUser)?.user || {};
        // Send a simple role-removed email to the guest
        await EmailService.sendEventRoleRemovedEmail(guestEmail, {
          event: event
            ? { title: (event as EventLike).title }
            : { title: "Event" },
          user: { email: guestEmail, name: guestName },
          roleName,
          actor: {
            firstName: (actor as UserLike)?.firstName || "",
            lastName: (actor as UserLike)?.lastName || "",
          },
        });
      } catch (emailErr) {
        console.error("Failed to send guest removal email:", emailErr);
        // Do not fail the cancellation flow if email sending fails
        GuestCancellationController.log.error(
          "Failed to send guest removal email",
          emailErr as Error,
          undefined,
          { id, eventId, roleId, guestEmail }
        );
        try {
          CorrelatedLogger.fromRequest(
            req,
            "GuestCancellationController"
          ).error(
            "Failed to send guest removal email",
            emailErr as Error,
            undefined,
            { id, eventId, roleId, guestEmail }
          );
        } catch {
          /* ignore */
        }
      }

      // Emit WebSocket update
      try {
        socketService.emitEventUpdate(eventId, "guest_cancellation", {
          eventId,
          roleId,
          guestName,
          timestamp: new Date(),
        });
      } catch (socketError) {
        console.error("Failed to emit cancellation update:", socketError);
        GuestCancellationController.log.error(
          "Failed to emit cancellation update",
          socketError as Error,
          undefined,
          { eventId, roleId, guestName }
        );
        try {
          CorrelatedLogger.fromRequest(
            req,
            "GuestCancellationController"
          ).error(
            "Failed to emit cancellation update",
            socketError as Error,
            undefined,
            { eventId, roleId, guestName }
          );
        } catch {
          /* ignore */
        }
      }

      res.status(200).json({
        success: true,
        message: "Guest registration cancelled successfully",
      });
    } catch (error) {
      console.error("Error cancelling guest registration:", error);
      GuestCancellationController.log.error(
        "Error cancelling guest registration",
        error as Error,
        undefined,
        { id: (req.params || {}).id }
      );
      try {
        CorrelatedLogger.fromRequest(req, "GuestCancellationController").error(
          "Error cancelling guest registration",
          error as Error,
          undefined,
          { id: (req.params || {}).id }
        );
      } catch {
        /* ignore */
      }
      res.status(500).json({
        success: false,
        message: "Failed to cancel guest registration",
      });
    }
  }
}

export default GuestCancellationController;
