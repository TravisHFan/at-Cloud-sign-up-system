import { EmailOptions } from "../../email";
import { buildRegistrationICS } from "../../ICSBuilder";
import { createLogger } from "../../../services/LoggerService";
import { EmailHelpers } from "../EmailHelpers";

const log = createLogger("EventEmailService");

interface EmailTemplateData {
  name?: string;
  email?: string;
  eventTitle?: string;
  eventDate?: string;
  [key: string]: any;
}

/**
 * EventEmailService
 *
 * Handles all event-related email notifications:
 * - Event creation and notification emails
 * - Event reminders (single and bulk)
 * - Co-organizer assignments
 * - Role assignments, moves, and removals
 * - Role assignment rejections
 * - Auto-unpublish notifications
 *
 * Extracted from EmailService.ts for better organization and maintainability.
 */
export class EventEmailService {
  /**
   * Core email sending method - delegates to EmailTransporter
   * This is a convenience method to avoid importing EmailTransporter in every method
   */
  private static async sendEmail(options: EmailOptions): Promise<boolean> {
    // Import EmailServiceFacade dynamically to avoid circular dependency
    const { EmailService } = await import(
      "../../infrastructure/EmailServiceFacade"
    );
    return EmailService.sendEmail(options);
  }

  /**
   * Helper method to format date/time range for email display
   */
  private static formatDateTimeRange(
    date: string,
    startTime: string,
    endTime?: string,
    endDate?: string,
    timeZone?: string
  ): string {
    return EmailHelpers.formatDateTimeRange(
      date,
      startTime,
      endTime,
      endDate,
      timeZone
    );
  }

  // ===== EXACT COPIES OF METHODS FROM ORIGINAL EmailService.ts =====
  // Methods will be extracted using sed to ensure exact copies

  static async sendEventNotificationEmailBulk(
    recipients: Array<{ email: string; name?: string }>,
    payload: {
      eventTitle: string;
      date: string;
      endDate?: string;
      time?: string;
      endTime?: string;
      timeZone?: string;
      message?: string;
    }
  ): Promise<boolean[]> {
    const seen = new Set<string>();
    const unique = recipients.filter((r) => {
      const key = (r.email || "").trim().toLowerCase();
      if (!key) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return Promise.all(
      unique.map((r) =>
        EventEmailService.sendEventNotificationEmail(
          r.email,
          r.name || r.email,
          payload
        ).catch((err) => {
          console.error(
            `❌ Failed to send event update email to ${r.email}:`,
            err
          );
          return false;
        })
      )
    );
  }
  static async sendEventAutoUnpublishNotification(params: {
    eventId: string;
    title: string;
    format?: string;
    missingFields?: string[];
    recipients?: string[]; // optional override; eventually replace with organizer list
  }): Promise<boolean> {
    try {
      const frontend = process.env.FRONTEND_URL || "http://localhost:5173";
      const manageUrl = `${frontend}/events/${params.eventId}/edit`;
      const missingFields = params.missingFields || [];
      const missingHuman = missingFields.length
        ? missingFields.join(", ")
        : "(unspecified)";
      const to = (
        params.recipients && params.recipients.length
          ? params.recipients
          : [process.env.FALLBACK_ADMIN_EMAIL || "atcloudministry@gmail.com"]
      ).join(",");
      const subject = `[Action Required] Event Auto-Unpublished – ${params.title}`;
      const html = `<!DOCTYPE html><html><body style=\"font-family:Arial,sans-serif;line-height:1.5;color:#333;\">\n<h2 style=\"margin:0 0 12px;\">Event Automatically Unpublished</h2>\n<p>The event <strong>${
        params.title
      }</strong> was automatically unpublished because it's missing required field(s) needed for the <em>${
        params.format || "current"
      }</em> format.</p>\n<p style=\"background:#fff8e1;padding:10px 14px;border:1px solid #ffe0a3;border-radius:6px;\"><strong>Missing:</strong> ${missingHuman}</p>\n<p><strong>Next Step:</strong> Provide the missing information, then publish again.</p>\n<p><a href=\"${manageUrl}\" style=\"display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:4px;\">Fix & Re-Publish</a></p>\n<p style=\"font-size:12px;color:#666;margin-top:24px;\">Event ID: ${
        params.eventId
      }</p>\n</body></html>`;
      const text = `Event '${params.title}' auto-unpublished. Missing: ${missingHuman}. Edit: ${manageUrl}`;
      return this.sendEmail({ to, subject, html, text });
    } catch (err) {
      try {
        log.error("sendEventAutoUnpublishNotification failed", err as Error);
      } catch {}
      return false;
    }
  }
  static async sendEventNotificationEmail(
    email: string,
    name: string,
    data: EmailTemplateData
  ): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Event Notification - @Cloud Ministry</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #4facfe; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Event Update</h1>
            </div>
            <div class="content">
              <h2>Hello ${name},</h2>
              <p>We have an update regarding the event: <strong>${
                data.eventTitle
              }</strong></p>
              <div class="event-detail">
                <strong>📅 Date & Time:</strong> ${(() => {
                  const date = (data as any).eventDate || (data as any).date;
                  const time = (data as any).eventTime || (data as any).time;
                  const endTime =
                    (data as any).eventEndTime || (data as any).endTime;
                  const endDate =
                    (data as any).eventEndDate || (data as any).endDate;
                  const tz = (data as any).timeZone;
                  if (date && time) {
                    return EventEmailService.formatDateTimeRange(
                      date,
                      time,
                      endTime,
                      endDate,
                      tz
                    );
                  }
                  return (data as any).eventDate || "TBD";
                })()}
              </div>
              <p>${
                data.message || "Please check your dashboard for more details."
              }</p>
              <div style="text-align: center;">
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/dashboard" class="button">View Dashboard</a>
              </div>
              <p>Thank you for your participation in @Cloud Ministry events!</p>
              <p>Blessings,<br>The @Cloud Ministry Team</p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry | Building Community Through Faith</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `Event Update: ${data.eventTitle}`,
      html,
    });
  }
  static async sendEventCreatedEmail(
    email: string,
    name: string,
    eventData: {
      title: string;
      date: string;
      endDate?: string;
      time: string;
      endTime: string;
      location?: string;
      zoomLink?: string;
      organizer: string;
      purpose?: string;
      format: string;
      timeZone?: string;
      recurringInfo?: {
        frequency: "every-two-weeks" | "monthly" | "every-two-months" | string;
        occurrenceCount: number;
      };
    }
  ): Promise<boolean> {
    const formatDateTimeRange = (
      date: string,
      startTime: string,
      endTime?: string,
      endDate?: string
    ) =>
      EventEmailService.formatDateTimeRange(
        date,
        startTime,
        endTime,
        endDate,
        eventData.timeZone
      );

    const eventLocation =
      eventData.format === "Online"
        ? "Online Meeting"
        : eventData.location || "Location TBD";

    const freqMap: Record<string, string> = {
      "every-two-weeks": "Every Two Weeks",
      monthly: "Monthly",
      "every-two-months": "Every Two Months",
    };

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Event Created - @Cloud Ministry</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .event-card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4facfe; }
            .event-detail { margin: 10px 0; }
            .event-detail strong { color: #4facfe; }
            .button { display: inline-block; padding: 12px 30px; background: #4facfe; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 New Event Created!</h1>
            </div>
            <div class="content">
              <h2>Hello ${name},</h2>
              <p>A new event has been created and is now available for registration!</p>
              
              <div class="event-card">
                <h3>${eventData.title}</h3>
                <div class="event-detail">
                  <strong>📅 Date & Time:</strong> ${formatDateTimeRange(
                    eventData.date,
                    eventData.time,
                    eventData.endTime,
                    eventData.endDate
                  )}
                </div>
                <div class="event-detail">
                  <strong>📍 Location:</strong> ${eventLocation}
                </div>
                <div class="event-detail">
                  <strong>👤 Organizer:</strong> ${eventData.organizer}
                </div>
                ${
                  eventData.purpose
                    ? `<div class="event-detail">
                  <strong>🎯 Purpose:</strong> ${eventData.purpose}
                </div>`
                    : ""
                }
                <div class="event-detail">
                  <strong>💻 Format:</strong> ${eventData.format}
                </div>
                ${
                  eventData.recurringInfo
                    ? `
                <div class="event-detail">
                  <strong>🔁 Recurrence:</strong> ${
                    freqMap[eventData.recurringInfo.frequency] ||
                    eventData.recurringInfo.frequency
                  } (${
                        eventData.recurringInfo.occurrenceCount
                      } total occurrences)
                </div>
                `
                    : ""
                }
                ${
                  eventData.zoomLink
                    ? `
                <div class="event-detail">
                  <strong>🔗 Join Link:</strong> <a href="${eventData.zoomLink}">Online Meeting</a>
                </div>
                `
                    : ""
                }
              </div>

              <p>Don't miss out! Sign up now to secure your spot.</p>
              
              <div style="text-align: center;">
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/dashboard/upcoming" class="button">View & Register for Event</a>
              </div>
              
              <p>We look forward to seeing you there!</p>
              <p>Blessings,<br>The @Cloud Ministry Team</p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry | Building Community Through Faith</p>
              <p>If you have any questions, please contact us at atcloudministry@gmail.com</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `🎉 New Event: ${eventData.title}`,
      html,
      text: `New event created: ${eventData.title} on ${formatDateTimeRange(
        eventData.date,
        eventData.time,
        eventData.endTime,
        eventData.endDate
      )} at ${eventLocation}. ${
        eventData.recurringInfo
          ? `Recurrence: ${
              freqMap[eventData.recurringInfo.frequency] ||
              eventData.recurringInfo.frequency
            } (${eventData.recurringInfo.occurrenceCount} total). `
          : ""
      }Visit your dashboard to register: ${
        process.env.FRONTEND_URL || "http://localhost:5173"
      }/dashboard/upcoming`,
    });
  }
  static async sendCoOrganizerAssignedEmail(
    coOrganizerEmail: string,
    assignedUser: {
      firstName: string;
      lastName: string;
    },
    eventData: {
      title: string;
      date: string;
      time: string;
      endTime?: string;
      endDate?: string;
      location: string;
    },
    assignedBy: {
      firstName: string;
      lastName: string;
    }
  ): Promise<boolean> {
    const coOrganizerName = `${assignedUser.firstName || ""} ${
      assignedUser.lastName || ""
    }`.trim();

    const organizerName = `${assignedBy.firstName || ""} ${
      assignedBy.lastName || ""
    }`.trim();

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Co-Organizer Assignment - @Cloud Ministry</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .welcome-message { background: #e7e3ff; border-left: 4px solid #6f42c1; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .event-details { background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; border: 1px solid #dee2e6; }
            .responsibility-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .button { display: inline-block; background: #6f42c1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
            .button:hover { background: #5a32a3; }
            .button.secondary { background: #6c757d; }
            .button.secondary:hover { background: #545b62; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
            .contact-info { background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; margin: 20px 0; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Welcome to the Team!</h1>
              <p>You've been assigned as Co-Organizer</p>
            </div>
            <div class="content">
              <p>Hello ${coOrganizerName},</p>
              
              <div class="welcome-message">
                <h3>🤝 Co-Organizer Assignment</h3>
                <p>You have been assigned as a <strong>Co-Organizer</strong> for an upcoming event. Welcome to the organizing team!</p>
              </div>

              <div class="event-details">
                <h4>📅 Event Details:</h4>
                <p><strong>Event:</strong> ${eventData.title}</p>
                <p><strong>Date & Time:</strong> ${EventEmailService.formatDateTimeRange(
                  eventData.date,
                  eventData.time,
                  eventData.endTime,
                  eventData.endDate,
                  (eventData as any).timeZone
                )}</p>
                <p><strong>Location:</strong> ${eventData.location}</p>
                <p><strong>Assigned by:</strong> ${organizerName}</p>
              </div>

              <div class="responsibility-box">
                <h4>🎯 Your Responsibilities:</h4>
                <ul>
                  <li>Help coordinate event logistics and planning</li>
                  <li>Assist with participant communication and management</li>
                  <li>Support the main organizer during the event</li>
                  <li>Help ensure the event runs smoothly</li>
                </ul>
              </div>

              <div class="contact-info">
                <h4>📞 Main Organizer Contact:</h4>
                <p><strong>${organizerName}</strong> is the main organizer for this event. Please reach out if you have any questions or need guidance.</p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="#{EVENT_DASHBOARD_URL}/events/${
                  eventData.title
                }" class="button">View Event Details</a>
                <a href="#{EVENT_DASHBOARD_URL}/organize" class="button secondary">Event Management</a>
              </div>

              <p>Thank you for volunteering to help organize this event. Your contribution makes a difference in our ministry!</p>
              
              <p><em>If you have any questions about your role or the event, please don't hesitate to contact the main organizer.</em></p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry Event Management</p>
              <p>This email was sent regarding your co-organizer assignment.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: coOrganizerEmail,
      subject: `🎉 Co-Organizer Assignment: ${eventData.title}`,
      html,
      text: `You have been assigned as Co-Organizer for "${
        eventData.title
      }" on ${EventEmailService.formatDateTimeRange(
        eventData.date,
        eventData.time,
        eventData.endTime,
        eventData.endDate,
        (eventData as any).timeZone
      )}. Location: ${
        eventData.location
      }. Assigned by: ${organizerName}. Please check the event management dashboard for more details.`,
    });
  }
  static async sendEventReminderEmail(
    email: string,
    userName: string,
    eventData: {
      title: string;
      date: string;
      time: string;
      endTime?: string;
      endDate?: string;
      location: string;
      zoomLink?: string;
      format: string;
      timeZone?: string;
    },
    reminderType: "1h" | "24h" | "1week"
  ): Promise<boolean> {
    const reminderLabels = {
      "1h": { label: "1 Hour", urgency: "high", emoji: "🚨" },
      "24h": { label: "24 Hours", urgency: "medium", emoji: "⏰" },
      "1week": { label: "1 Week", urgency: "low", emoji: "📅" },
    };

    const reminder = reminderLabels[reminderType];
    const isUrgent = reminderType === "1h";
    const isOnline = eventData.format === "Online";
    const isHybrid = eventData.format === "Hybrid Participation";
    const isVirtual = isOnline || (isHybrid && eventData.zoomLink);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Event Reminder - @Cloud Ministry</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #ff6b6b 0%, #ffa500 100%); color: white; padding: 30px; text-align: center; }
            .header.urgent { background: linear-gradient(135deg, #dc3545 0%, #fd7e14 100%); }
            .header.medium { background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%); }
            .header.low { background: linear-gradient(135deg, #17a2b8 0%, #20c997 100%); }
            .content { padding: 30px; }
            .reminder-badge { display: inline-block; background: #dc3545; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; margin: 10px 0; }
            .reminder-badge.medium { background: #ffc107; color: #212529; }
            .reminder-badge.low { background: #17a2b8; }
            .event-details { background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; border: 1px solid #dee2e6; }
            .countdown { background: #ffe8e8; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0; border-radius: 4px; text-align: center; font-size: 18px; font-weight: bold; }
            .countdown.medium { background: #fff3cd; border-left-color: #ffc107; }
            .countdown.low { background: #d1ecf1; border-left-color: #17a2b8; }
            .virtual-info { background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .location-info { background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .button { display: inline-block; background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 5px; font-weight: bold; }
            .button:hover { background: #c82333; }
            .button.virtual { background: #28a745; }
            .button.virtual:hover { background: #218838; }
            .button.calendar { background: #6c757d; }
            .button.calendar:hover { background: #545b62; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header ${reminder.urgency}">
              <h1>${reminder.emoji} Event Reminder</h1>
              <p>${reminder.label} Until Event</p>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              
              <div class="reminder-badge ${reminder.urgency}">
                ${reminder.emoji} ${reminder.label} Reminder
              </div>

              <div class="countdown ${reminder.urgency}">
                ${
                  isUrgent
                    ? "🚨 STARTING SOON! 🚨"
                    : reminder.urgency === "medium"
                    ? "⏰ Tomorrow!"
                    : "📅 Coming Up!"
                }
              </div>

              <div class="event-details">
                <h3>📋 Event Details:</h3>
                <p><strong>Event:</strong> ${eventData.title}</p>
                <p><strong>Date & Time:</strong> ${EventEmailService.formatDateTimeRange(
                  eventData.date,
                  eventData.time,
                  eventData.endTime,
                  eventData.endDate,
                  eventData.timeZone
                )}</p>
                <p><strong>Format:</strong> ${eventData.format}</p>
                ${
                  isVirtual
                    ? `<p><strong>Platform:</strong> ${
                        isHybrid
                          ? "Hybrid (In-person + Online)"
                          : "Virtual Meeting"
                      }</p>`
                    : `<p><strong>Location:</strong> ${eventData.location}</p>`
                }
              </div>

              ${
                isVirtual && eventData.zoomLink
                  ? `
                <div class="virtual-info">
                  <h4>💻 ${
                    isHybrid
                      ? "Online Access for Hybrid Event:"
                      : "Virtual Event Access:"
                  }</h4>
                  <p>${
                    isHybrid
                      ? "This is a hybrid event. You can attend either in-person or online using the link below:"
                      : "This is a virtual event. Use the link below to join:"
                  }
                  </p>
                  <div style="text-align: center; margin: 15px 0;">
                    <a href="${eventData.zoomLink}" class="button virtual">${
                      isHybrid ? "Join Online" : "Join Virtual Event"
                    }</a>
                  </div>
                  <p><em>Please test your audio and video before the event starts.</em></p>
                </div>
              `
                  : !isVirtual
                  ? `
                <div class="location-info">
                  <h4>📍 In-Person Event Location:</h4>
                  <p><strong>Address:</strong> ${eventData.location}</p>
                  <p><em>Please arrive 10-15 minutes early for check-in.</em></p>
                </div>
              `
                  : ""
              }

              <div style="text-align: center; margin: 30px 0;">
                ${
                  isVirtual && eventData.zoomLink
                    ? `<a href="${eventData.zoomLink}" class="button virtual">${
                        isHybrid ? "Join Online" : "Join Now"
                      }</a>`
                    : `<a href="#{EVENT_DETAILS_URL}/${eventData.title}" class="button">View Event Details</a>`
                }
                <a href="#{CALENDAR_URL}" class="button calendar">Add to Calendar</a>
              </div>

              <p>
                ${
                  isUrgent
                    ? "<strong>The event is starting very soon! Please make sure you're ready to participate.</strong>"
                    : reminder.urgency === "medium"
                    ? "The event is tomorrow! Please make your final preparations."
                    : "Just a friendly reminder about this upcoming event. Mark your calendar!"
                }
              </p>

              <p>We look forward to seeing you there!</p>
              
              <p><em>If you need to cancel your attendance, please let us know as soon as possible.</em></p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry Event Notifications</p>
              <p>This reminder was sent for your registered event participation.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `${reminder.emoji} Reminder: ${eventData.title} - ${reminder.label}`,
      html,
      text: `${reminder.emoji} Event Reminder: "${
        eventData.title
      }" is ${reminder.label.toLowerCase()} away! ${EventEmailService.formatDateTimeRange(
        eventData.date,
        eventData.time,
        eventData.endTime,
        eventData.endDate,
        eventData.timeZone
      )}. ${
        isVirtual
          ? `Join link: ${eventData.zoomLink || "Virtual event"}`
          : `Location: ${eventData.location}`
      }. Format: ${eventData.format}.`,
    });
  }
  static async sendEventReminderEmailBulk(
    recipients: Array<{ email: string; name?: string }>,
    eventData: {
      title: string;
      date: string;
      time: string;
      endTime?: string;
      endDate?: string;
      location: string;
      zoomLink?: string;
      format: string;
      timeZone?: string;
    },
    reminderType: "1h" | "24h" | "1week"
  ): Promise<boolean[]> {
    const seen = new Set<string>();
    const unique = recipients.filter((r) => {
      const key = (r.email || "").trim().toLowerCase();
      if (!key) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return Promise.all(
      unique.map((r) =>
        EventEmailService.sendEventReminderEmail(
          r.email,
          r.name || r.email,
          eventData,
          reminderType
        ).catch((err) => {
          console.error(
            `❌ Failed to send event reminder email to ${r.email}:`,
            err
          );
          return false;
        })
      )
    );
  }
  static async sendEventRoleAssignedEmail(
    to: string,
    data: {
      event: any;
      user: any;
      roleName: string;
      actor: any;
      rejectionToken?: string;
    }
  ): Promise<boolean> {
    const { event, roleName, actor, user, rejectionToken } = data;
    const subject = `✅ Invited to ${roleName} - ${event.title}`;
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    // Direct link to view the event details (protected route). If user not logged in, they'll be redirected after login.
    // NOTE: Currently our frontend protects /dashboard/event/:id. If we expose a public /events/:id we can adjust later.
    const eventDetailUrl = `${baseUrl}/dashboard/event/${encodeURIComponent(
      event.id || event._id || ""
    )}`;
    // Rejection token creation is deferred to assignment creation flow; placeholder parameter usage.
    const hasRealToken = Boolean(
      rejectionToken && !rejectionToken.includes("{{")
    );
    const token = hasRealToken
      ? encodeURIComponent(rejectionToken as string)
      : "";
    const rejectionLink = hasRealToken
      ? `${baseUrl}/assignments/reject?token=${token}`
      : "";
    if (!hasRealToken) {
      // Warn (non-fatal) so missing token can be traced. Avoid leaking in prod logs if spammy.
      if (process.env.NODE_ENV !== "test") {
        console.warn(
          "sendEventRoleAssignedEmail: rejectionToken missing; link omitted"
        );
      }
    }
    // Format comprehensive event details similar to public registration confirmation
    const formatEventDateTime = () => {
      if (!event.date || !event.time) return "Time details not available";

      const dateTimeRange = this.formatDateTimeRange(
        event.date,
        event.time,
        event.endTime,
        event.endDate,
        event.timeZone
      );
      return dateTimeRange;
    };

    const eventDateTime = formatEventDateTime();

    // Format location display based on event format
    const getLocationDisplay = () => {
      const format = event.format || "";
      if (format === "Online") return "Online Meeting";
      if (format === "Hybrid Participation") {
        return event.location
          ? `${event.location} (Hybrid: In-person + Online)`
          : "Hybrid: In-person + Online";
      }
      return event.location || "Location TBD";
    };

    const locationDisplay = getLocationDisplay();

    // Build comprehensive text version
    const textParts = [
      `${actor.firstName} ${actor.lastName} invited you to serve as "${roleName}" for event "${event.title}".`,
      "",
      "EVENT DETAILS:",
      `📅 When: ${eventDateTime}`,
      `📍 Location: ${locationDisplay}`,
    ];

    if (event.purpose) {
      textParts.push(`🎯 Purpose: ${event.purpose}`);
    }

    if (event.format) {
      textParts.push(`💻 Format: ${event.format}`);
    }

    // Virtual meeting details for text version
    if (
      (event.format === "Online" || event.format === "Hybrid Participation") &&
      event.zoomLink
    ) {
      textParts.push(`🔗 Meeting Link: ${event.zoomLink}`);
      if (event.meetingId && event.passcode) {
        textParts.push(`📞 Meeting ID: ${event.meetingId}`);
        textParts.push(`🔐 Passcode: ${event.passcode}`);
      }
    }

    textParts.push("");
    textParts.push(
      `View the event and this role's responsibilities: ${eventDetailUrl}`
    );
    textParts.push("If you accept this invitation, no action is required.");

    if (hasRealToken) {
      textParts.push(
        "If you need to decline this invitation, please use the link below to tell the organizer so they can invite other users for this role:",
        rejectionLink
      );
    } else {
      textParts.push(
        "(Rejection link unavailable – please contact the organizer directly if you need to decline.)"
      );
    }
    const text = textParts.join("\n");

    // Build comprehensive HTML version
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;font-size:14px;">
        <p>Hi ${user?.firstName || user?.username || "there"},</p>
        <p>${actor.firstName} ${
      actor.lastName
    } <strong>invited</strong> you to the role <strong>${roleName}</strong> for event <em>${
      event.title
    }</em></p>
        
        <div style="background:#f8f9fa;padding:16px;margin:16px 0;border-radius:6px;border-left:4px solid #2563eb;">
          <h3 style="margin:0 0 12px 0;color:#2563eb;font-size:16px;">📋 Event Details</h3>
          <p style="margin:4px 0;"><strong>📅 When:</strong> ${eventDateTime}</p>
          <p style="margin:4px 0;"><strong>📍 Location:</strong> ${locationDisplay}</p>
          ${
            event.purpose
              ? `<p style="margin:4px 0;"><strong>🎯 Purpose:</strong> ${event.purpose}</p>`
              : ""
          }
          ${
            event.format
              ? `<p style="margin:4px 0;"><strong>💻 Format:</strong> ${event.format}</p>`
              : ""
          }
          
          ${
            (event.format === "Online" ||
              event.format === "Hybrid Participation") &&
            event.zoomLink
              ? `
            <div style="margin-top:12px;padding-top:12px;border-top:1px solid #dee2e6;">
              <p style="margin:4px 0;"><strong>🔗 Meeting Link:</strong> <a href="${
                event.zoomLink
              }" style="color:#2563eb;">Join Online Meeting</a></p>
              ${
                event.meetingId && event.passcode
                  ? `
                <p style="margin:4px 0;"><strong>📞 Meeting ID:</strong> ${event.meetingId}</p>
                <p style="margin:4px 0;"><strong>🔐 Passcode:</strong> ${event.passcode}</p>
              `
                  : ""
              }
            </div>
          `
              : ""
          }
        </div>

        <p style="margin-top:16px;">You can review the event details and this role's responsibilities using the button below. If you <strong>accept</strong> this invitation, no action is required.</p>
        <p style="text-align:center;margin:20px 0;">
          <a href="${eventDetailUrl}" style="background:#2563eb;color:#fff;padding:12px 22px;text-decoration:none;border-radius:6px;display:inline-block;">See the Event & Role Details</a>
        </p>
        ${
          hasRealToken
            ? `<p>If you need to <strong>decline</strong> this invitation, please click the button below to tell the organizer so they can invite other users for this role:</p>
        <p style="text-align:center;margin:20px 0;">
          <a href="${rejectionLink}" style="background:#c62828;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;display:inline-block;">Decline This Invitation</a>
        </p>
        <p style="font-size:12px;color:#666;">This decline link expires in 14 days. After submission, the invitation will be released.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
        <p style="font-size:12px;color:#888;">If the decline button doesn’t work, copy and paste this URL into your browser:<br/>
          <span style="word-break:break-all;">${rejectionLink}</span>
        </p>`
            : `<p style="margin-top:16px;color:#b71c1c;"><strong>Note:</strong> A decline link was not generated. Please contact the organizer if you cannot serve in this role.</p>`
        }
        <p style="font-size:12px;color:#888;margin-top:32px;">If you're not signed in you'll be asked to log in first, then you'll be taken directly to the event page.</p>
      </div>
    `;

    // Generate ICS calendar attachment with proper timezone handling
    try {
      const ics = buildRegistrationICS({
        event: {
          _id: event._id || event.id,
          title: event.title,
          date: event.date,
          endDate: event.endDate || event.date,
          time: event.time,
          endTime: event.endTime,
          location: event.location,
          purpose: event.purpose,
          timeZone: event.timeZone,
        },
        role: { name: roleName, description: `Role: ${roleName}` },
        attendeeEmail: to,
      });

      console.log("ICS generation successful for role assignment email:", {
        filename: ics.filename,
        contentLength: ics.content.length,
        to,
        roleName,
      });

      return this.sendEmail({
        to,
        subject,
        text,
        html,
        attachments: [
          {
            filename: ics.filename,
            content: ics.content,
            contentType: "text/calendar; charset=utf-8; method=PUBLISH",
          },
        ],
      });
    } catch (icsError) {
      // Fallback: send email without ICS attachment if generation fails
      console.warn(
        "ICS generation failed for role assignment email:",
        icsError
      );
      console.warn("Event data that failed ICS generation:", {
        id: event._id || event.id,
        title: event.title,
        date: event.date,
        endDate: event.endDate,
        time: event.time,
        endTime: event.endTime,
        location: event.location,
        purpose: event.purpose,
        timeZone: event.timeZone,
      });
      return this.sendEmail({ to, subject, text, html });
    }
  }
  static async sendEventRoleRemovedEmail(
    to: string,
    data: { event: any; user: any; roleName: string; actor: any }
  ): Promise<boolean> {
    const { event, roleName, actor } = data;
    const subject = `⚠️ Removed from ${roleName} - ${event.title}`;
    const text = `You have been removed from the role "${roleName}" in event "${event.title}" by ${actor.firstName} ${actor.lastName}.`;
    const html = `<p>You have been <strong>removed</strong> from the role <strong>${roleName}</strong> in event <em>${event.title}</em> by ${actor.firstName} ${actor.lastName}.</p>`;
    return this.sendEmail({ to, subject, text, html });
  }
  static async sendEventRoleMovedEmail(
    to: string,
    data: {
      event: any;
      user: any;
      fromRoleName: string;
      toRoleName: string;
      actor: any;
    }
  ): Promise<boolean> {
    const { event, fromRoleName, toRoleName, actor, user } = data;
    const subject = `🔄 Role Updated: ${toRoleName} - ${event.title}`;

    // Format comprehensive event details similar to assignment email
    const formatEventDateTime = () => {
      if (!event.date || !event.time) return "Time details not available";

      const dateTimeRange = this.formatDateTimeRange(
        event.date,
        event.time,
        event.endTime,
        event.endDate,
        event.timeZone
      );
      return dateTimeRange;
    };

    const eventDateTime = formatEventDateTime();

    // Format location display based on event format
    const getLocationDisplay = () => {
      const format = event.format || "";
      if (format === "Online") return "Online Meeting";
      if (format === "Hybrid Participation") {
        return event.location
          ? `${event.location} (Hybrid: In-person + Online)`
          : "Hybrid: In-person + Online";
      }
      return event.location || "Location TBD";
    };

    const locationDisplay = getLocationDisplay();
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const eventDetailUrl = `${baseUrl}/dashboard/event/${encodeURIComponent(
      event.id || event._id || ""
    )}`;

    // Build comprehensive text version
    const textParts = [
      `Your role in event "${event.title}" was updated by ${actor.firstName} ${actor.lastName}.`,
      `From "${fromRoleName}" → To "${toRoleName}"`,
      "",
      "EVENT DETAILS:",
      `📅 When: ${eventDateTime}`,
      `📍 Location: ${locationDisplay}`,
    ];

    if (event.purpose) {
      textParts.push(`🎯 Purpose: ${event.purpose}`);
    }

    if (event.format) {
      textParts.push(`💻 Format: ${event.format}`);
    }

    // Virtual meeting details for text version
    if (
      (event.format === "Online" || event.format === "Hybrid Participation") &&
      event.zoomLink
    ) {
      textParts.push(`🔗 Meeting Link: ${event.zoomLink}`);
      if (event.meetingId && event.passcode) {
        textParts.push(`📞 Meeting ID: ${event.meetingId}`);
        textParts.push(`🔐 Passcode: ${event.passcode}`);
      }
    }

    textParts.push("");
    textParts.push(`View full event details: ${eventDetailUrl}`);

    const text = textParts.join("\n");

    // Build comprehensive HTML version
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;font-size:14px;">
        <p>Hi ${user?.firstName || user?.username || "there"},</p>
        <p>Your role in event <em>${
          event.title
        }</em> was <strong>updated</strong> by ${actor.firstName} ${
      actor.lastName
    }:</p>
        <p style="text-align:center;margin:12px 0;padding:12px;background:#f0f8ff;border-radius:6px;">
          <strong style="color:#dc3545;">${fromRoleName}</strong> 
          <span style="margin:0 8px;color:#6c757d;">→</span> 
          <strong style="color:#28a745;">${toRoleName}</strong>
        </p>
        
        <div style="background:#f8f9fa;padding:16px;margin:16px 0;border-radius:6px;border-left:4px solid #2563eb;">
          <h3 style="margin:0 0 12px 0;color:#2563eb;font-size:16px;">📋 Event Details</h3>
          <p style="margin:4px 0;"><strong>📅 When:</strong> ${eventDateTime}</p>
          <p style="margin:4px 0;"><strong>📍 Location:</strong> ${locationDisplay}</p>
          ${
            event.purpose
              ? `<p style="margin:4px 0;"><strong>🎯 Purpose:</strong> ${event.purpose}</p>`
              : ""
          }
          ${
            event.format
              ? `<p style="margin:4px 0;"><strong>💻 Format:</strong> ${event.format}</p>`
              : ""
          }
          
          ${
            (event.format === "Online" ||
              event.format === "Hybrid Participation") &&
            event.zoomLink
              ? `
            <div style="margin-top:12px;padding-top:12px;border-top:1px solid #dee2e6;">
              <p style="margin:4px 0;"><strong>🔗 Meeting Link:</strong> <a href="${
                event.zoomLink
              }" style="color:#2563eb;">Join Online Meeting</a></p>
              ${
                event.meetingId && event.passcode
                  ? `
                <p style="margin:4px 0;"><strong>📞 Meeting ID:</strong> ${event.meetingId}</p>
                <p style="margin:4px 0;"><strong>🔐 Passcode:</strong> ${event.passcode}</p>
              `
                  : ""
              }
            </div>
          `
              : ""
          }
        </div>

        <p style="text-align:center;margin:20px 0;">
          <a href="${eventDetailUrl}" style="background:#2563eb;color:#fff;padding:12px 22px;text-decoration:none;border-radius:6px;display:inline-block;">View Full Event Details</a>
        </p>
        
        <p style="margin-top:16px;">Your new role assignment is now active. Thank you for your continued participation!</p>
      </div>
    `;

    // Generate ICS calendar attachment with proper timezone handling for the new role
    try {
      const ics = buildRegistrationICS({
        event: {
          _id: event._id || event.id,
          title: event.title,
          date: event.date,
          endDate: event.endDate || event.date,
          time: event.time,
          endTime: event.endTime,
          location: event.location,
          purpose: event.purpose,
          timeZone: event.timeZone,
        },
        role: { name: toRoleName, description: `Role: ${toRoleName}` },
        attendeeEmail: to,
      });

      console.log("ICS generation successful for role moved email:", {
        filename: ics.filename,
        contentLength: ics.content.length,
        to,
        toRoleName,
      });

      return this.sendEmail({
        to,
        subject,
        text,
        html,
        attachments: [
          {
            filename: ics.filename,
            content: ics.content,
            contentType: "text/calendar; charset=utf-8; method=PUBLISH",
          },
        ],
      });
    } catch (icsError) {
      // Fallback: send email without ICS attachment if generation fails
      console.warn("ICS generation failed for role moved email:", icsError);
      console.warn("Event data that failed ICS generation:", {
        id: event._id || event.id,
        title: event.title,
        date: event.date,
        endDate: event.endDate,
        time: event.time,
        endTime: event.endTime,
        location: event.location,
        purpose: event.purpose,
        timeZone: event.timeZone,
      });
      return this.sendEmail({ to, subject, text, html });
    }
  }
  static async sendEventRoleAssignmentRejectedEmail(
    to: string,
    data: {
      event: { id: string; title: string };
      roleName: string;
      rejectedBy: { firstName?: string; lastName?: string };
      assigner: { firstName?: string; lastName?: string };
      noteProvided: boolean;
      noteText?: string; // newly passed raw note text (optional)
    }
  ): Promise<boolean> {
    const { event, roleName, rejectedBy, assigner, noteProvided } = data;
    const subject = `❌ Invitation Declined: ${roleName} - ${event.title}`;
    const rejecterName = `${rejectedBy.firstName || "A user"} ${
      rejectedBy.lastName || ""
    }`.trim();
    const assignerName = `${assigner.firstName || "You"} ${
      assigner.lastName || ""
    }`.trim();
    const escapeHtml = (s: string) =>
      String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const rawNote = (data as any).noteText as string | undefined;
    const cleanedNote =
      rawNote && rawNote.trim() ? rawNote.trim().slice(0, 1000) : undefined;
    const noteLine = noteProvided
      ? cleanedNote
        ? `Rejection note: \n${cleanedNote}`
        : "A rejection note was provided in the system."
      : "No rejection note was provided.";
    const text = [
      `${rejecterName} declined the invitation for role "${roleName}" in event "${event.title}".`,
      noteLine,
      "You may reassign this role or contact the user if clarification is needed.",
    ].join("\n\n");
    const noteHtml = noteProvided
      ? cleanedNote
        ? `<div style="margin:12px 0;padding:12px;background:#fafafa;border:1px solid #eee;border-radius:4px;">
             <strong style="display:block;margin-bottom:4px;">Rejection Note:</strong>
             <div style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(
               cleanedNote
             )}</div>
           </div>`
        : `<p>A rejection note was provided in the system.</p>`
      : `<p>No rejection note was provided.</p>`;
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;font-size:14px;">
        <p><strong>${rejecterName}</strong> has <strong>declined</strong> the invitation for the role <strong>${roleName}</strong> in event <em>${event.title}</em>.</p>
        ${noteHtml}
        <p style="margin-top:16px;">You can reassign this role or reach out to the user if more context is needed.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
        <p style="font-size:12px;color:#666;">This is an automated notification regarding role invitation decline.</p>
      </div>
    `;
    return this.sendEmail({ to, subject, text, html });
  }
}
