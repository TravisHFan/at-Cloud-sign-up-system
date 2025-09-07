import { Request, Response } from "express";
import { EmailService } from "../services/infrastructure/emailService";

// Response helper utilities (following the pattern from userController)
class ResponseHelper {
  static success(
    res: Response,
    message?: string,
    data?: unknown,
    statusCode: number = 200
  ): void {
    const payload: Record<string, unknown> = { success: true };
    if (message) payload.message = message;
    if (typeof data !== "undefined") payload.data = data as unknown;
    res.status(statusCode).json(payload);
  }

  static badRequest(res: Response, message: string): void {
    res.status(400).json({
      success: false,
      message,
    });
  }

  static internalServerError(res: Response, message: string): void {
    res.status(500).json({
      success: false,
      message,
    });
  }
}

export class FeedbackController {
  /**
   * Submit feedback from users
   */
  static async submitFeedback(req: Request, res: Response): Promise<void> {
    try {
      const { type, subject, message, includeContact } = req.body;
      const currentUser = req.user;

      // Validate required fields
      if (!type || !subject || !message) {
        return ResponseHelper.badRequest(
          res,
          "Type, subject, and message are required"
        );
      }

      // Validate feedback type
      const validTypes = ["bug", "improvement", "general"];
      if (!validTypes.includes(type)) {
        return ResponseHelper.badRequest(
          res,
          "Type must be one of: bug, improvement, general"
        );
      }

      // Validate subject length
      if (subject.length > 200) {
        return ResponseHelper.badRequest(
          res,
          "Subject must be 200 characters or less"
        );
      }

      // Validate message length
      if (message.length > 2000) {
        return ResponseHelper.badRequest(
          res,
          "Message must be 2000 characters or less"
        );
      }

      // Prepare email content
      const userInfo = currentUser
        ? `
        User ID: ${currentUser._id}
        Name: ${currentUser.firstName} ${currentUser.lastName}
        Email: ${currentUser.email}
        Role: ${currentUser.role}
        Include Contact: ${includeContact ? "Yes" : "No"}
        `
        : "Anonymous user";

      const emailSubject = `[@Cloud Feedback] ${type.toUpperCase()}: ${subject}`;
      const emailBody = `
        New feedback submitted from @Cloud Sign-up System:

        Type: ${type.toUpperCase()}
        Subject: ${subject}

        Message:
        ${message}

        User Information:
        ${userInfo}

        Submitted at: ${new Date().toISOString()}
      `;

      // Build HTML content for EmailService wrapper
      const contentHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #1f2937; margin: 0 0 10px 0;">@Cloud System Feedback</h2>
              <p style="color: #6b7280; margin: 0; font-size: 14px;">New feedback received from the sign-up system</p>
            </div>
            
            <div style="background-color: white; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
              <div style="margin-bottom: 20px;">
                <h3 style="color: #374151; margin: 0 0 8px 0;">Feedback Details</h3>
                <p style="margin: 4px 0;"><strong>Type:</strong> <span style="background-color: ${
                  type === "bug"
                    ? "#fef2f2; color: #dc2626"
                    : type === "improvement"
                    ? "#f0f9ff; color: #2563eb"
                    : "#f9fafb; color: #374151"
                }; padding: 2px 8px; border-radius: 4px; font-size: 12px; text-transform: uppercase;">${type}</span></p>
                <p style="margin: 4px 0;"><strong>Subject:</strong> ${subject}</p>
                <p style="margin: 4px 0;"><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
              </div>
              
              <div style="margin-bottom: 20px;">
                <h4 style="color: #374151; margin: 0 0 8px 0;">Message</h4>
                <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; border-left: 4px solid #3b82f6;">
                  <p style="margin: 0; white-space: pre-wrap; color: #374151;">${message}</p>
                </div>
              </div>
              
              ${
                currentUser
                  ? `
              <div>
                <h4 style="color: #374151; margin: 0 0 8px 0;">User Information</h4>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 4px 0; border-bottom: 1px solid #f3f4f6;"><strong>User ID:</strong></td><td style="padding: 4px 0; border-bottom: 1px solid #f3f4f6;">${
                    currentUser._id
                  }</td></tr>
                  <tr><td style="padding: 4px 0; border-bottom: 1px solid #f3f4f6;"><strong>Name:</strong></td><td style="padding: 4px 0; border-bottom: 1px solid #f3f4f6;">${
                    currentUser.firstName
                  } ${currentUser.lastName}</td></tr>
                  <tr><td style="padding: 4px 0; border-bottom: 1px solid #f3f4f6;"><strong>Email:</strong></td><td style="padding: 4px 0; border-bottom: 1px solid #f3f4f6;">${
                    currentUser.email
                  }</td></tr>
                  <tr><td style="padding: 4px 0; border-bottom: 1px solid #f3f4f6;"><strong>Role:</strong></td><td style="padding: 4px 0; border-bottom: 1px solid #f3f4f6;">${
                    currentUser.role
                  }</td></tr>
                  <tr><td style="padding: 4px 0;"><strong>Include Contact:</strong></td><td style="padding: 4px 0;">${
                    includeContact ? "Yes" : "No"
                  }</td></tr>
                </table>
              </div>
              `
                  : `
              <div>
                <p style="color: #6b7280; font-style: italic;">Submitted by anonymous user</p>
              </div>
              `
              }
            </div>
            
            <div style="margin-top: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
              <p>This is an automated message from @Cloud Sign-up System</p>
            </div>
          </div>
      `;

      // Send email to system administrators using centralized EmailService
      const systemEmail =
        process.env.SYSTEM_EMAIL || process.env.SMTP_USER || "";
      if (!systemEmail) {
        console.warn(
          "SYSTEM_EMAIL/SMTP_USER not configured; feedback email suppressed."
        );
      } else {
        await EmailService.sendGenericNotificationEmail(
          systemEmail,
          "@Cloud System Feedback",
          {
            subject: emailSubject,
            contentHtml,
            contentText: emailBody,
          }
        );
      }

      return ResponseHelper.success(res, "Feedback submitted successfully", {
        submitted: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      console.error("Feedback submission error:", error);
      return ResponseHelper.internalServerError(
        res,
        "Failed to submit feedback. Please try again later."
      );
    }
  }
}
