import { Request, Response } from "express";
import mongoose from "mongoose";
import { Event } from "../../models";
import { PERMISSIONS, hasPermission } from "../../utils/roleUtils";
import { isEventOrganizer } from "../../utils/event/eventPermissions";
import { CorrelatedLogger } from "../../services/CorrelatedLogger";
import { EventCascadeService } from "../../services";
import AuditLog from "../../models/AuditLog";
import { EventController } from "../eventController";

/**
 * DeletionController
 *
 * Handles event deletion operations with proper permissions and cascade deletion.
 */
export class DeletionController {
  /**
   * Delete an event with cascade deletion of registrations
   * DELETE /api/events/:id
   *
   * Requires DELETE_ANY_EVENT or DELETE_OWN_EVENT permission.
   * If event has participants, requires force-delete permission.
   */
  static async deleteEvent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid event ID.",
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const event = await Event.findById(id);

      if (!event) {
        res.status(404).json({
          success: false,
          message: "Event not found.",
        });
        return;
      }

      // Check permissions
      const canDeleteAnyEvent = hasPermission(
        req.user.role,
        PERMISSIONS.DELETE_ANY_EVENT
      );
      const canDeleteOwnEvent = hasPermission(
        req.user.role,
        PERMISSIONS.DELETE_OWN_EVENT
      );
      const userIsOrganizer = isEventOrganizer(
        event,
        EventController.toIdString(req.user._id)
      );

      if (!canDeleteAnyEvent && !(canDeleteOwnEvent && userIsOrganizer)) {
        res.status(403).json({
          success: false,
          message:
            "Insufficient permissions to delete this event. You must be the event creator or a co-organizer.",
        });
        return;
      }

      // If event has participants, ensure caller has force-delete permission
      if (event.signedUp > 0) {
        const canForceDelete =
          canDeleteAnyEvent || (canDeleteOwnEvent && userIsOrganizer);
        if (!canForceDelete) {
          res.status(400).json({
            success: false,
            message:
              "Cannot delete event with registered participants. Please remove all participants first, or contact an Administrator or Super Admin for force deletion.",
          });
          return;
        }
      }

      // Perform cascade deletion via service
      const {
        deletedRegistrations: deletedRegistrationsCount,
        deletedGuestRegistrations: deletedGuestRegistrationsCount,
      } = await EventCascadeService.deleteEventFully(id);

      // Audit log for event deletion
      try {
        await AuditLog.create({
          action: "event_deletion",
          actor: {
            id: req.user._id,
            role: req.user.role,
            email: req.user.email,
          },
          targetModel: "Event",
          targetId: id,
          details: {
            targetEvent: {
              id: event._id,
              title: event.title,
              type: event.type,
              date: event.date,
              location: event.location,
            },
            cascadeInfo: {
              deletedRegistrations: deletedRegistrationsCount,
              deletedGuestRegistrations: deletedGuestRegistrationsCount,
            },
          },
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || "unknown",
        });
      } catch (auditError) {
        console.error(
          "Failed to create audit log for event deletion:",
          auditError
        );
        // Don't fail the request if audit logging fails
      }

      const response: {
        success: true;
        message: string;
        deletedRegistrations?: number;
        deletedGuestRegistrations?: number;
      } = {
        success: true,
        message:
          deletedRegistrationsCount > 0
            ? `Event deleted successfully! Also removed ${deletedRegistrationsCount} associated registrations${
                deletedGuestRegistrationsCount > 0
                  ? ` and ${deletedGuestRegistrationsCount} guest registrations`
                  : ""
              }.`
            : "Event deleted successfully!",
      };

      if (deletedRegistrationsCount > 0) {
        response.deletedRegistrations = deletedRegistrationsCount;
      }
      if (deletedGuestRegistrationsCount > 0) {
        response.deletedGuestRegistrations = deletedGuestRegistrationsCount;
      }

      res.status(200).json(response);
    } catch (error: unknown) {
      console.error("Delete event error:", error);
      CorrelatedLogger.fromRequest(req, "EventController").error(
        "deleteEvent failed",
        error as Error,
        undefined,
        { eventId: req.params?.id }
      );
      res.status(500).json({
        success: false,
        message: "Failed to delete event.",
      });
    }
  }
}
