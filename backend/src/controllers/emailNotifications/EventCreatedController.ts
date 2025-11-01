import { Request, Response } from "express";
import { EmailRecipientUtils } from "../../utils/emailRecipientUtils";
import { EmailService } from "../../services/infrastructure/EmailServiceFacade";
import { CorrelatedLogger } from "../../services/CorrelatedLogger";
import type { EventCreatedRequest } from "./types";

export default class EventCreatedController {
  static async sendEventCreatedNotification(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { eventData, excludeEmail }: EventCreatedRequest = req.body;

      if (!eventData || !eventData.title || !eventData.date) {
        res.status(400).json({
          success: false,
          message: "Event data is required with title and date",
        });
        return;
      }

      // Get all active, verified users who want emails
      const recipients = await EmailRecipientUtils.getActiveVerifiedUsers(
        excludeEmail
      );

      if (recipients.length === 0) {
        res.status(200).json({
          success: true,
          message: "No eligible recipients found",
          recipientCount: 0,
        });
        return;
      }

      // Transform data to match existing email service format
      const emailEventData = {
        title: eventData.title,
        date: eventData.date,
        endDate: (eventData as { endDate?: string }).endDate,
        time: eventData.time,
        endTime: eventData.endTime || "TBD",
        location: eventData.location,
        zoomLink: eventData.zoomLink,
        organizer: eventData.organizerName,
        purpose: eventData.purpose || "",
        format: eventData.format || "",
      };

      // Send emails in parallel
      const emailPromises = recipients.map(
        (user: { email: string; firstName: string; lastName: string }) =>
          EmailService.sendEventCreatedEmail(
            user.email,
            `${user.firstName || ""} ${user.lastName || ""}`.trim(),
            emailEventData
          ).catch((error: unknown) => {
            console.error(
              `Failed to send event notification to ${user.email}:`,
              error
            );
            return false as boolean;
          })
      );

      await Promise.all(emailPromises);

      res.status(200).json({
        success: true,
        message: "Event creation notifications sent successfully",
        recipientCount: recipients.length,
      });
    } catch (error) {
      console.error("Error sending event creation notifications:", error);
      CorrelatedLogger.fromRequest(req, "EmailNotificationController").error(
        "sendEventCreatedNotification failed",
        error as Error
      );
      res.status(500).json({
        success: false,
        message: "Failed to send event creation notifications",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
