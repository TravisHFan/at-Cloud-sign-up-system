import { Request, Response } from "express";
import { EmailService } from "../../services/infrastructure/EmailServiceFacade";
import { CorrelatedLogger } from "../../services/CorrelatedLogger";
import type { CoOrganizerAssignedRequest } from "./types";

export default class CoOrganizerAssignedController {
  /**
   * Send co-organizer assignment notification
   * POST /api/notifications/co-organizer-assigned
   */
  static async sendCoOrganizerAssignedNotification(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const {
        assignedUser,
        eventData,
        assignedBy,
      }: CoOrganizerAssignedRequest = req.body;

      if (
        !assignedUser ||
        !assignedUser.email ||
        !eventData ||
        !eventData.title
      ) {
        res.status(400).json({
          success: false,
          message: "Assigned user and event data are required",
        });
        return;
      }

      // Validate assignedBy data
      if (!assignedBy || !assignedBy.firstName) {
        res.status(400).json({
          success: false,
          message: "Assigned by information is required",
        });
        return;
      }

      // Send email to the newly assigned co-organizer
      const emailSent = await EmailService.sendCoOrganizerAssignedEmail(
        assignedUser.email,
        {
          firstName: assignedUser.firstName,
          lastName: assignedUser.lastName || "",
        },
        {
          title: eventData.title,
          date: eventData.date || "TBD",
          time: eventData.time || "TBD",
          location: eventData.location || "TBD",
        },
        {
          firstName: assignedBy.firstName,
          lastName: assignedBy.lastName || "",
        }
      );

      const recipientCount = emailSent ? 1 : 0;

      const assignedUserName = `${assignedUser.firstName} ${
        assignedUser.lastName || ""
      }`.trim();
      const assignedByName = `${assignedBy.firstName} ${
        assignedBy.lastName || ""
      }`.trim();

      console.log(
        `Co-organizer assignment notification: ${assignedUserName} assigned to ${eventData.title} by ${assignedByName} - Email sent: ${emailSent}`
      );

      res.status(200).json({
        success: true,
        message: `Co-organizer assignment notification sent to ${recipientCount} recipient(s)`,
        recipientCount,
      });
    } catch (error) {
      console.error(
        "Error sending co-organizer assignment notification:",
        error
      );
      CorrelatedLogger.fromRequest(req, "EmailNotificationController").error(
        "sendCoOrganizerAssignedNotification failed",
        error as Error
      );
      res.status(500).json({
        success: false,
        message: "Failed to send co-organizer assignment notification",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
