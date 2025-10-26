import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { createLogger } from "../../services/LoggerService";
import { buildRegistrationICS } from "../ICSBuilder";
import {
  generateVerificationEmail,
  generatePasswordResetEmail,
  generatePasswordChangeRequestEmail,
  generatePasswordResetSuccessEmail,
  generateWelcomeEmail,
} from "../../templates/email";
import {
  EmailTransporter,
  EmailDeduplication,
  EmailHelpers,
  EmailOptions,
} from "../email";
import { AuthEmailService } from "../email/domains/AuthEmailService";
import { EventEmailService } from "../email/domains/EventEmailService";
import { RoleEmailService } from "../email/domains/RoleEmailService";

dotenv.config();

const log = createLogger("EmailService");

interface EmailTemplateData {
  name?: string;
  email?: string;
  verificationUrl?: string;
  resetUrl?: string;
  eventTitle?: string;
  eventDate?: string;
  [key: string]: any;
}

export class EmailService {
  // NOTE: Additional template referenced via TrioNotificationService for guest declines:
  // 'guest-invitation-declined' (assigner/event creator notification when a guest declines)

  /**
   * Test-only: clear internal dedupe cache to avoid cross-test interference.
   * Safe to call in any environment; no effect on behavior other than cache state.
   */
  static __clearDedupeCacheForTests(): void {
    EmailDeduplication.__clearDedupeCacheForTests();
  }

  static async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      // Global duplicate suppression (opt-in): avoid sending the exact same email payload
      // to the same recipient multiple times within a short TTL window.
      if (EmailDeduplication.isDuplicate(options)) {
        try {
          log.info("Duplicate email suppressed by dedupe cache", undefined, {
            to: options.to,
            subject: options.subject,
          });
        } catch {}
        return true; // treat as success
      }

      // Skip email sending in test environment
      if (process.env.NODE_ENV === "test") {
        console.log(
          `📧 Email skipped in test environment: ${options.subject} to ${options.to}`
        );
        // Structured log, keep console for tests
        try {
          log.info("Email skipped in test environment", undefined, {
            to: options.to,
            subject: options.subject,
          });
        } catch {}
        return true;
      }

      const info = await EmailTransporter.send(options);

      // Check if we're using jsonTransport (development mode without real credentials)
      if (
        info.response &&
        typeof info.response === "string" &&
        info.response.includes('"jsonTransport":true')
      ) {
        console.log("📧 Development Email (not actually sent):");
        console.log(`   To: ${options.to}`);
        console.log(`   Subject: ${options.subject}`);
        console.log(`   Preview URL would be available in production`);
        try {
          log.info("Development Email (jsonTransport)", undefined, {
            to: options.to,
            subject: options.subject,
          });
        } catch {}
        return true;
      }

      if (process.env.NODE_ENV !== "production") {
        console.log("📧 Email sent successfully:");
        console.log(`   To: ${options.to}`);
        console.log(`   Subject: ${options.subject}`);
        if (info.messageId) {
          console.log(`   Message ID: ${info.messageId}`);
        }
        try {
          log.info("Email sent successfully", undefined, {
            to: options.to,
            subject: options.subject,
            messageId: info.messageId,
          });
        } catch {}
      }

      return true;
    } catch (error) {
      console.error("❌ Email send failed:", error);
      try {
        log.error("Email send failed", error as Error | undefined, undefined, {
          to: options.to,
          subject: options.subject,
        });
      } catch {}
      return false;
    }
  }

  // ===== Shared Date-Time Formatting Helpers (delegated to EmailHelpers) =====
  private static normalizeTimeTo24h(time: string): string {
    return EmailHelpers.normalizeTimeTo24h(time);
  }

  private static buildDate(
    date: string,
    time: string,
    timeZone?: string
  ): Date {
    return EmailHelpers.buildDate(date, time, timeZone);
  }

  private static formatDateTime(
    date: string,
    time: string,
    timeZone?: string
  ): string {
    return EmailHelpers.formatDateTime(date, time, timeZone);
  }

  private static formatTime(
    time: string,
    timeZone?: string,
    date?: string
  ): string {
    return EmailHelpers.formatTime(time, timeZone, date);
  }

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

  /**
   * Bulk helper: send event update notifications to unique recipients by email.
   * Duplicates (same email, case-insensitive) will be collapsed to a single send.
   */
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
    return EventEmailService.sendEventNotificationEmailBulk(
      recipients,
      payload
    );
  }

  static async sendVerificationEmail(
    email: string,
    name: string,
    verificationToken: string
  ): Promise<boolean> {
    return AuthEmailService.sendVerificationEmail(
      email,
      name,
      verificationToken
    );
  }

  static async sendPasswordResetEmail(
    email: string,
    name: string,
    resetToken: string
  ): Promise<boolean> {
    return AuthEmailService.sendPasswordResetEmail(email, name, resetToken);
  }

  static async sendPasswordChangeRequestEmail(
    email: string,
    name: string,
    confirmToken: string
  ): Promise<boolean> {
    return AuthEmailService.sendPasswordChangeRequestEmail(
      email,
      name,
      confirmToken
    );
  }

  // ===== Guest Email Helpers =====
  /**
   * Stub notification for auto-unpublish events.
   * The integration test spies on this method. Implemented as a thin wrapper around sendEmail
   * (currently no-op under test env). Future enhancement: include list of missing fields.
   */
  static async sendEventAutoUnpublishNotification(params: {
    eventId: string;
    title: string;
    format?: string;
    missingFields?: string[];
    recipients?: string[]; // optional override; eventually replace with organizer list
  }): Promise<boolean> {
    return EventEmailService.sendEventAutoUnpublishNotification(params);
  }
  static async sendGuestConfirmationEmail(params: {
    guestEmail: string;
    guestName: string;
    event: {
      title: string;
      date: Date | string;
      location?: string;
      time?: string;
      endTime?: string;
      endDate?: Date | string;
      timeZone?: string;
      // Virtual/Details support
      format?: string; // "In-person" | "Online" | "Hybrid Participation"
      isHybrid?: boolean;
      zoomLink?: string;
      agenda?: string;
      purpose?: string;
      meetingId?: string;
      passcode?: string;
      organizerDetails?: Array<{
        name: string;
        role: string;
        email: string;
        phone?: string;
      }>;
      // Fallback organizer contact when organizerDetails is empty
      createdBy?: {
        firstName?: string;
        lastName?: string;
        username?: string;
        email?: string;
        phone?: string;
        avatar?: string;
        gender?: string;
      };
    };
    role: { name: string; description?: string };
    registrationId: string;
    manageToken?: string; // optional self-service token for future use
    inviterName?: string; // optional: if present, indicates organizer invited the guest
    declineToken?: string; // optional decline token (only for invited guests)
  }): Promise<boolean> {
    const frontend = process.env.FRONTEND_URL || "http://localhost:5173";
    const manageUrl = params.manageToken
      ? `${frontend}/guest/manage/${params.manageToken}`
      : `${frontend}/guest/confirmation`;

    const eventDate =
      params.event && (params.event as any).date
        ? new Date(params.event.date)
        : undefined;
    const dateStr = eventDate
      ? this.formatDateTimeRange(
          eventDate.toISOString().slice(0, 10),
          params.event.time || "00:00",
          params.event.endTime,
          params.event.endDate
            ? new Date(params.event.endDate).toISOString().slice(0, 10)
            : undefined,
          params.event.timeZone
        )
      : undefined;

    // Location display rules for confirmation emails:
    // - Online: force label "Online" regardless of stored value.
    // - Hybrid Participation: include the physical location if provided (even though hidden on public page).
    // - In-person: include the physical location if provided.
    // - Otherwise: include location if present.
    const locationForEmail = (() => {
      const fmt = (params.event.format || "").trim();
      if (fmt === "Online") return "Online";
      // Hybrid or In-person: pass through stored location (may be undefined)
      if (fmt === "Hybrid Participation" || fmt === "In-person") {
        return params.event.location || undefined;
      }
      return params.event.location || undefined;
    })();

    // Minimal HTML escaping helper
    const escapeHtml = (s: string) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");

    // Virtual meeting info: Meeting ID + Passcode define "Meeting Details"
    const meetingId = (params.event.meetingId || "").toString().trim();
    const passcode = (params.event.passcode || "").toString().trim();
    const hasZoomLink = !!(
      params.event.zoomLink && String(params.event.zoomLink).trim()
    );
    const hasMeetingDetails = !!(meetingId && passcode);
    const shouldShowVirtualSections = hasZoomLink && hasMeetingDetails; // fallback if either missing

    // Build organizer contact list: always include primary Organizer (createdBy) when contact info exists,
    // then append any co-organizers from organizerDetails. De-duplicate by email.
    const organizerContacts: Array<{
      name: string;
      role: string;
      email?: string;
      phone?: string;
    }> = (() => {
      const contacts: Array<{
        name: string;
        role: string;
        email?: string;
        phone?: string;
      }> = [];

      // Primary Organizer from createdBy (if contact info present)
      const cb = params.event.createdBy;
      if (cb && (cb.email || cb.phone)) {
        const name =
          [cb.firstName, cb.lastName].filter(Boolean).join(" ") ||
          cb.username ||
          "Organizer";
        contacts.push({
          name,
          role: "Organizer",
          email: cb.email,
          phone: cb.phone,
        });
      }

      // Append organizerDetails (commonly co-organizers)
      if (Array.isArray(params.event.organizerDetails)) {
        for (const o of params.event.organizerDetails) {
          contacts.push({
            name: o.name,
            role: o.role,
            email: o.email,
            phone: o.phone,
          });
        }
      }

      // De-duplicate by email (if email present). Prefer the first occurrence (which would be createdBy if overlapping)
      const seen = new Set<string>();
      const deduped: typeof contacts = [];
      for (const c of contacts) {
        const key = (c.email || "").trim().toLowerCase();
        if (!key) {
          // No email: allow multiple distinct entries without email
          deduped.push(c);
          continue;
        }
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(c);
      }

      return deduped;
    })();

    // Additional content blocks
    const purposeHtml = escapeHtml(String(params.event.purpose || "")).replace(
      /\n/g,
      "<br/>"
    );
    const descriptionHtml = "";
    const agendaHtml = escapeHtml(String(params.event.agenda || "")).replace(
      /\n/g,
      "<br/>"
    );

    // Use the same logic as organizer contacts to get the inviter name
    const getInviterName = (): string => {
      // Extract from event.createdBy (same logic used for organizer contacts)
      const cb = params.event.createdBy;
      if (cb) {
        const name = [cb.firstName, cb.lastName].filter(Boolean).join(" ");
        if (name) return name;
        if (cb.username) return cb.username;
      }

      // Fallback to first organizer in organizerDetails
      if (
        Array.isArray(params.event.organizerDetails) &&
        params.event.organizerDetails.length > 0
      ) {
        const firstOrganizer = params.event.organizerDetails[0];
        if (
          firstOrganizer.name &&
          firstOrganizer.name.toLowerCase() !== "organizer"
        ) {
          return firstOrganizer.name;
        }
      }

      return "an Organizer";
    };

    const actualInviterName = getInviterName();
    const invited = !!params.inviterName; // Keep original invited flag logic
    const heading = invited
      ? "You have been invited as a Guest"
      : "You're Registered as a Guest";
    const introLine = invited
      ? `You have been invited as a Guest by <strong>${escapeHtml(
          actualInviterName
        )}</strong> for <strong>${escapeHtml(params.event.title)}</strong>.`
      : `Thank you for registering as a guest for <strong>${escapeHtml(
          params.event.title
        )}</strong>.`;

    // Decline section (always show for invited guests, like user assignment emails)
    const declineHtml = (() => {
      if (!invited) return "";

      const hasDeclineToken = !!params.declineToken;
      if (!hasDeclineToken) {
        return `
        <div class="section" style="margin-top:30px;">
          <p>If you need to <strong>decline</strong> this invitation, please contact the organizer using the contact information above so they can invite someone else for this role.</p>
          <p style="margin-top:16px;color:#b71c1c;"><strong>Note:</strong> A decline link was not generated. Please contact the organizer if you cannot participate in this role.</p>
        </div>`;
      }
      const declineUrl = `${frontend}/guest/decline/${encodeURIComponent(
        params.declineToken!
      )}`;
      return `
        <div class="section" style="margin-top:30px;">
          <p>If you need to <strong>decline</strong> this invitation, please click the button below to tell the organizer so they can invite someone else for this role:</p>
          <p style="text-align:center;margin:20px 0;">
            <a href="${declineUrl}" style="background:#c62828;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;display:inline-block;">Decline This Invitation</a>
          </p>
          <p style="font-size:12px;color:#666;">This decline link expires in 14 days. After submission, the invitation will be released.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
          <p style="font-size:12px;color:#888;">If the button doesn’t work, copy and paste this URL:<br/><span style="word-break:break-all;">${declineUrl}</span></p>
        </div>`;
    })();

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Guest Registration Confirmed - @Cloud Ministry</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #22c1c3 0%, #fdbb2d 100%); color: white; padding: 24px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 24px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 10px 20px; background: #22c1c3; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .section { margin: 18px 0; }
            .muted { color: #444; }
            .virtual { background: #0ea5e9; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${heading}</h1>
            </div>
            <div class="content">
              <p>Hello ${params.guestName},</p>
              <p>${introLine}</p>
              ${dateStr ? `<p><strong>When:</strong> ${dateStr}</p>` : ""}
              ${
                locationForEmail
                  ? `<p><strong>Location:</strong> ${locationForEmail}</p>`
                  : ""
              }
              <p><strong>Role:</strong> ${params.role.name}</p>
              <p><small>Registration ID: ${params.registrationId}</small></p>

              ${
                shouldShowVirtualSections
                  ? `
                <div class="section">
                  <h3>Online Meeting Link</h3>
                  <p>
                    <a href="${String(
                      params.event.zoomLink
                    )}" class="button virtual">Join Online Meeting</a>
                  </p>
                  <p class="muted">If the button doesn't work, use this link: <a href="${String(
                    params.event.zoomLink
                  )}">${String(params.event.zoomLink)}</a></p>
                </div>
                <div class="section">
                  <h3>Meeting Details</h3>
                  <ul>
                    <li><strong>Meeting ID:</strong> ${escapeHtml(
                      meetingId
                    )}</li>
                    <li><strong>Passcode:</strong> ${escapeHtml(passcode)}</li>
                  </ul>
                </div>
              `
                  : `
                <div class="section">
                  <p>
                    The meeting link and event details will be provided via a separate email once confirmed. We appreciate your patience.
                  </p>
                </div>
              `
              }
              ${declineHtml}

              ${
                purposeHtml
                  ? `<div class="section"><h3>Purpose</h3><p>${purposeHtml}</p></div>`
                  : ""
              }
              
              ${
                agendaHtml
                  ? `<div class="section"><h3>Event Agenda and Schedule</h3><p>${agendaHtml}</p></div>`
                  : ""
              }

              ${
                organizerContacts.length > 0
                  ? `<div class="section"><h3>Organizer Contact Information</h3>
                    <ul>
                      ${organizerContacts
                        .map((o) => {
                          const phone = (o.phone || "").trim();
                          const email = (o.email || "").trim();
                          const emailHtml = email
                            ? ` — Email: <a href=\"mailto:${escapeHtml(
                                email
                              )}\">${escapeHtml(email)}</a>`
                            : "";
                          const phoneHtml = phone
                            ? `${email ? ", " : " — "}Phone: ${escapeHtml(
                                phone
                              )}`
                            : "";
                          return `<li><strong>${escapeHtml(
                            o.name
                          )}</strong> (${escapeHtml(
                            o.role
                          )})${emailHtml}${phoneHtml}</li>`;
                        })
                        .join("")}
                    </ul>
                   </div>`
                  : ""
              }
              <div class="section">
                <h3>Want Full Event Access?</h3>
                <p>We recommend creating an @Cloud account so you can view full event details, receive updates, and manage your participation.</p>
                <p style="text-align:center"><a href="${frontend}/signup" class="button">Sign Up / Create Account</a></p>
              </div>

              <p>If you have any other questions, please reply to this email.</p>
              <p>Blessings,<br/>The @Cloud Ministry Team</p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry | Building Community Through Faith</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Build text version
    const text = (() => {
      const lines: string[] = [];
      lines.push(
        `You're registered for ${params.event.title}. ${
          dateStr ? `When: ${dateStr}. ` : ""
        }Role: ${params.role.name}. Manage: ${manageUrl}`
      );
      if (shouldShowVirtualSections) {
        lines.push(`Online Meeting Link: ${String(params.event.zoomLink)}`);
        lines.push(`Meeting ID: ${meetingId}`);
        lines.push(`Passcode: ${passcode}`);
      } else {
        lines.push(
          "The meeting link and event details will be provided via a separate email once confirmed. We appreciate your patience."
        );
      }
      if (locationForEmail) lines.push(`Location: ${locationForEmail}`);
      if (params.event.purpose) lines.push(`Purpose: ${params.event.purpose}`);

      if (params.event.agenda)
        lines.push(`Event Agenda and Schedule: ${params.event.agenda}`);
      if (organizerContacts.length > 0) {
        lines.push("Organizer Contact Information:");
        organizerContacts.forEach((o) => {
          const phone = (o.phone || "").trim();
          const email = (o.email || "").trim();
          const emailPart = email ? ` — Email: ${email}` : "";
          const phonePart = phone
            ? `${email ? ", " : " — "}Phone: ${phone}`
            : "";
          const contact = `${emailPart}${phonePart}`;
          lines.push(`- ${o.name} (${o.role})${contact}`);
        });
      }
      return lines.join("\n");
    })();

    // Generate ICS calendar attachment with proper timezone handling
    try {
      const eventDate =
        typeof params.event.date === "string"
          ? params.event.date
          : params.event.date.toISOString().slice(0, 10);
      const endEventDate = params.event.endDate
        ? typeof params.event.endDate === "string"
          ? params.event.endDate
          : params.event.endDate.toISOString().slice(0, 10)
        : eventDate;

      const ics = buildRegistrationICS({
        event: {
          _id: params.event.title, // Use title as fallback since we might not have _id
          title: params.event.title,
          date: eventDate,
          endDate: endEventDate,
          time: params.event.time || "00:00",
          endTime: params.event.endTime || params.event.time || "23:59",
          location: params.event.location || "",
          purpose: params.event.purpose || "",
          timeZone: params.event.timeZone || "UTC",
        },
        role: {
          name: params.role.name,
          description: params.role.description || `Role: ${params.role.name}`,
        },
        attendeeEmail: params.guestEmail,
      });

      console.log("ICS generation successful for guest confirmation email:", {
        filename: ics.filename,
        contentLength: ics.content.length,
        guestEmail: params.guestEmail,
        roleName: params.role.name,
      });

      return this.sendEmail({
        to: params.guestEmail,
        subject: `✅ You're registered for ${params.event.title}`,
        html,
        text,
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
        "ICS generation failed for guest confirmation email:",
        icsError
      );
      console.warn("Guest event data that failed ICS generation:", {
        title: params.event.title,
        date: params.event.date,
        endDate: params.event.endDate,
        time: params.event.time,
        endTime: params.event.endTime,
        timeZone: params.event.timeZone,
      });

      // Send email without attachment as fallback
      return this.sendEmail({
        to: params.guestEmail,
        subject: `✅ You're registered for ${params.event.title}`,
        html,
        text,
      });
    }
  }

  /**
   * Notify organizers that a guest invitation was declined.
   */
  static async sendGuestDeclineNotification(params: {
    event: { title: string; date: Date | string };
    roleName?: string;
    guest: { name: string; email: string };
    reason?: string;
    organizerEmails: string[];
  }): Promise<boolean> {
    try {
      if (!params.organizerEmails || params.organizerEmails.length === 0)
        return false;
      const to = params.organizerEmails;
      const subject = `❌ Guest Declined: ${params.roleName || "Role"} - ${
        params.event.title
      }`;
      const esc = (v: unknown) =>
        String(v)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      const safeReason = params.reason ? esc(params.reason) : undefined;
      const dateStr = (() => {
        try {
          const d =
            params.event.date instanceof Date
              ? params.event.date
              : new Date(params.event.date);
          return d.toLocaleString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
        } catch {
          return String(params.event.date);
        }
      })();
      const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;line-height:1.5;color:#333;">
        <h2 style="color:#c62828;">Guest Invitation Declined</h2>
        <p><strong>${esc(params.guest.name)}</strong> (${esc(
        params.guest.email
      )}) has declined the invitation for role <strong>${esc(
        params.roleName || ""
      )}</strong> in event <em>${esc(params.event.title)}</em>.</p>
        ${dateStr ? `<p><strong>Event Date:</strong> ${dateStr}</p>` : ""}
        ${
          safeReason
            ? `<p><strong>Reason:</strong><br/><span style="white-space:pre-wrap;">${safeReason}</span></p>`
            : ""
        }
        <p style="font-size:12px;color:#666;margin-top:30px;">This is an automated notification regarding a guest invitation decline.</p>
      </body></html>`;
      const text = `${params.guest.name} declined guest invitation for role ${
        params.roleName || "Role"
      } in event ${params.event.title}${
        safeReason ? ` Reason: ${params.reason}` : ""
      }`;
      return this.sendEmail({ to, subject, html, text });
    } catch (err) {
      try {
        log.error("sendGuestDeclineNotification failed", err as Error);
      } catch {}
      return false;
    }
  }

  static async sendGuestRegistrationNotification(params: {
    organizerEmails: string[];
    event: {
      title: string;
      date: Date | string;
      location?: string;
      time?: string;
      endTime?: string;
      endDate?: Date | string;
      timeZone?: string;
    };
    guest: { name: string; email: string; phone?: string };
    role: { name: string };
    registrationDate: Date | string;
  }): Promise<boolean> {
    const recipients = (params.organizerEmails || []).filter(Boolean);
    if (recipients.length === 0) return true; // nothing to send

    const eventDate =
      params.event && (params.event as any).date
        ? new Date(params.event.date)
        : undefined;
    const dateStr = eventDate
      ? this.formatDateTimeRange(
          eventDate.toISOString().slice(0, 10),
          params.event.time || "00:00",
          params.event.endTime,
          params.event.endDate
            ? new Date(params.event.endDate).toISOString().slice(0, 10)
            : undefined,
          params.event.timeZone
        )
      : undefined;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Guest Registration - @Cloud Ministry</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #334155; color: white; padding: 18px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 18px; border-radius: 0 0 10px 10px; }
            .footer { text-align: center; margin-top: 16px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>New Guest Registration</h2>
            </div>
            <div class="content">
              <p><strong>Event:</strong> ${params.event.title}</p>
              ${dateStr ? `<p><strong>When:</strong> ${dateStr}</p>` : ""}
              ${
                params.event.location
                  ? `<p><strong>Location:</strong> ${params.event.location}</p>`
                  : ""
              }
              <p><strong>Role:</strong> ${params.role.name}</p>
              <p><strong>Guest:</strong> ${params.guest.name} (${
      params.guest.email
    }${params.guest.phone ? `, ${params.guest.phone}` : ""})</p>
              <p><strong>Time:</strong> ${new Date(
                params.registrationDate
              ).toLocaleString()}</p>
            </div>
            <div class="footer">
              <p>This is an automated notification from @Cloud Ministry.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send to all organizers individually to avoid exposing recipients
    const results = await Promise.all(
      recipients.map((to) =>
        this.sendEmail({
          to,
          subject: `👤 New Guest Registration: ${params.event.title}`,
          html,
          text: `New guest registration for ${params.event.title}. Guest: ${
            params.guest.name
          } (${params.guest.email}${
            params.guest.phone ? ", " + params.guest.phone : ""
          }). Role: ${params.role.name}. ${dateStr ? `When: ${dateStr}.` : ""}`,
        })
      )
    );
    return results.every(Boolean);
  }

  /**
   * Send account deactivation email to the user (no system message needed)
   */
  static async sendAccountDeactivationEmail(
    userEmail: string,
    userName: string,
    deactivatedBy: { role: string; firstName?: string; lastName?: string }
  ): Promise<boolean> {
    return AuthEmailService.sendAccountDeactivationEmail(
      userEmail,
      userName,
      deactivatedBy
    );
  }

  /**
   * Send account reactivation email to the user (no system message needed)
   */
  static async sendAccountReactivationEmail(
    userEmail: string,
    userName: string,
    reactivatedBy: { role: string; firstName?: string; lastName?: string }
  ): Promise<boolean> {
    return AuthEmailService.sendAccountReactivationEmail(
      userEmail,
      userName,
      reactivatedBy
    );
  }

  /**
   * Admin alert: user deactivated
   */
  static async sendUserDeactivatedAlertToAdmin(
    adminEmail: string,
    adminName: string,
    target: { firstName?: string; lastName?: string; email: string },
    actor: {
      firstName?: string;
      lastName?: string;
      email: string;
      role: string;
    }
  ): Promise<boolean> {
    const targetName =
      `${target.firstName || ""} ${target.lastName || ""}`.trim() ||
      target.email;
    const actorName =
      `${actor.firstName || ""} ${actor.lastName || ""}`.trim() || actor.email;
    const subject = `Admin Alert: User Account Deactivated (${targetName})`;
    const text = `Hello ${adminName},\n\n${
      actor.role
    } ${actorName} deactivated the account of ${targetName} (${
      target.email
    }).\n\nTime: ${new Date().toLocaleString()}\n\n— @Cloud System`;
    const html = `
      <!DOCTYPE html>
      <html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
      <title>${subject}</title>
      <style>body{font-family:Arial,sans-serif;color:#333} .container{max-width:600px;margin:0 auto;padding:20px} .header{background:#ffc107;color:#212529;padding:16px;border-radius:8px 8px 0 0} .content{background:#f9f9f9;padding:20px;border-radius:0 0 8px 8px}</style>
      </head><body><div class="container">
      <div class="header"><h2>Admin Alert: User Deactivated</h2></div>
      <div class="content">
        <p>Hello ${adminName},</p>
        <p><strong>${
          actor.role
        }</strong> <strong>${actorName}</strong> deactivated the account of <strong>${targetName}</strong> (${
      target.email
    }).</p>
        <p><small>Time: ${new Date().toLocaleString()}</small></p>
        <p>— @Cloud System</p>
      </div></div></body></html>`;
    return this.sendEmail({ to: adminEmail, subject, html, text });
  }

  /**
   * Admin alert: user reactivated
   */
  static async sendUserReactivatedAlertToAdmin(
    adminEmail: string,
    adminName: string,
    target: { firstName?: string; lastName?: string; email: string },
    actor: {
      firstName?: string;
      lastName?: string;
      email: string;
      role: string;
    }
  ): Promise<boolean> {
    const targetName =
      `${target.firstName || ""} ${target.lastName || ""}`.trim() ||
      target.email;
    const actorName =
      `${actor.firstName || ""} ${actor.lastName || ""}`.trim() || actor.email;
    const subject = `Admin Alert: User Account Reactivated (${targetName})`;
    const text = `Hello ${adminName},\n\n${
      actor.role
    } ${actorName} reactivated the account of ${targetName} (${
      target.email
    }).\n\nTime: ${new Date().toLocaleString()}\n\n— @Cloud System`;
    const html = `
      <!DOCTYPE html>
      <html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
      <title>${subject}</title>
      <style>body{font-family:Arial,sans-serif;color:#333} .container{max-width:600px;margin:0 auto;padding:20px} .header{background:#28a745;color:#fff;padding:16px;border-radius:8px 8px 0 0} .content{background:#f9f9f9;padding:20px;border-radius:0 0 8px 8px}</style>
      </head><body><div class="container">
      <div class="header"><h2>Admin Alert: User Reactivated</h2></div>
      <div class="content">
        <p>Hello ${adminName},</p>
        <p><strong>${
          actor.role
        }</strong> <strong>${actorName}</strong> reactivated the account of <strong>${targetName}</strong> (${
      target.email
    }).</p>
        <p><small>Time: ${new Date().toLocaleString()}</small></p>
        <p>— @Cloud System</p>
      </div></div></body></html>`;
    return this.sendEmail({ to: adminEmail, subject, html, text });
  }

  /**
   * Admin alert: user deleted
   */
  static async sendUserDeletedAlertToAdmin(
    adminEmail: string,
    adminName: string,
    target: { firstName?: string; lastName?: string; email: string },
    actor: {
      firstName?: string;
      lastName?: string;
      email: string;
      role: string;
    }
  ): Promise<boolean> {
    const targetName =
      `${target.firstName || ""} ${target.lastName || ""}`.trim() ||
      target.email;
    const actorName =
      `${actor.firstName || ""} ${actor.lastName || ""}`.trim() || actor.email;
    const subject = `Security Alert: User Deleted (${targetName})`;
    const text = `Hello ${adminName},\n\n${
      actor.role
    } ${actorName} permanently deleted the user ${targetName} (${
      target.email
    }).\n\nTime: ${new Date().toLocaleString()}\n\n— @Cloud System`;
    const html = `
      <!DOCTYPE html>
      <html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
      <title>${subject}</title>
      <style>body{font-family:Arial,sans-serif;color:#333} .container{max-width:600px;margin:0 auto;padding:20px} .header{background:#dc3545;color:#fff;padding:16px;border-radius:8px 8px 0 0} .content{background:#f9f9f9;padding:20px;border-radius:0 0 8px 8px}</style>
      </head><body><div class="container">
      <div class="header"><h2>Security Alert: User Deleted</h2></div>
      <div class="content">
        <p>Hello ${adminName},</p>
        <p><strong>${
          actor.role
        }</strong> <strong>${actorName}</strong> permanently deleted the user <strong>${targetName}</strong> (${
      target.email
    }).</p>
        <p><small>Time: ${new Date().toLocaleString()}</small></p>
        <p>— @Cloud System</p>
      </div></div></body></html>`;
    return this.sendEmail({ to: adminEmail, subject, html, text });
  }

  static async sendPasswordResetSuccessEmail(
    email: string,
    name: string
  ): Promise<boolean> {
    return AuthEmailService.sendPasswordResetSuccessEmail(email, name);
  }

  static async sendEventNotificationEmail(
    email: string,
    name: string,
    data: EmailTemplateData
  ): Promise<boolean> {
    return EventEmailService.sendEventNotificationEmail(email, name, data);
  }

  /**
   * Generic notification email with custom subject and content.
   * Minimal wrapper around sendEmail to keep controllers simple.
   */
  static async sendGenericNotificationEmail(
    to: string,
    nameOrTitle: string,
    payload: {
      subject: string;
      contentHtml: string;
      contentText?: string;
      attachments?: nodemailer.SendMailOptions["attachments"];
    }
  ): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${payload.subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #495057 0%, #6c757d 100%); color: white; padding: 22px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 24px; border-radius: 0 0 10px 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>${payload.subject}</h2>
            </div>
            <div class="content">
              ${payload.contentHtml}
              <p style="margin-top:20px;">Blessings,<br/>The @Cloud Ministry Team</p>
            </div>
          </div>
        </body>
      </html>
    `;
    return this.sendEmail({
      to,
      subject: payload.subject,
      html,
      text: payload.contentText,
      attachments: payload.attachments,
    });
  }

  static async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    return AuthEmailService.sendWelcomeEmail(email, name);
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
    return EventEmailService.sendEventCreatedEmail(email, name, eventData);
  }

  /**
   * Send promotion notification to the promoted user
   */
  static async sendPromotionNotificationToUser(
    email: string,
    userData: {
      firstName: string;
      lastName: string;
      oldRole: string;
      newRole: string;
    },
    changedBy: {
      firstName: string;
      lastName: string;
      role: string;
    }
  ): Promise<boolean> {
    return RoleEmailService.sendPromotionNotificationToUser(
      email,
      userData,
      changedBy
    );
  }

  /**
   * Send promotion notification to Super Admins and Administrators
   */
  static async sendPromotionNotificationToAdmins(
    adminEmail: string,
    adminName: string,
    userData: {
      firstName: string;
      lastName: string;
      email: string;
      oldRole: string;
      newRole: string;
    },
    changedBy: {
      firstName: string;
      lastName: string;
      role: string;
    }
  ): Promise<boolean> {
    return RoleEmailService.sendPromotionNotificationToAdmins(
      adminEmail,
      adminName,
      userData,
      changedBy
    );
  }

  /**
   * Send demotion notification to the demoted user
   * Pattern 3: Sensitive, respectful communication about role changes
   */
  static async sendDemotionNotificationToUser(
    userEmail: string,
    userData: {
      _id: string;
      firstName: string;
      lastName: string;
      email: string;
      oldRole: string;
      newRole: string;
    },
    changedBy: {
      firstName: string;
      lastName: string;
      email: string;
      role: string;
    },
    reason?: string
  ): Promise<boolean> {
    return RoleEmailService.sendDemotionNotificationToUser(
      userEmail,
      userData,
      changedBy,
      reason
    );
  }

  /**
   * Send demotion notification to administrators
   * Pattern 4: Administrative record and oversight notification for role demotions
   */
  static async sendDemotionNotificationToAdmins(
    adminEmail: string,
    adminName: string,
    userData: {
      _id: string;
      firstName: string;
      lastName: string;
      email: string;
      oldRole: string;
      newRole: string;
    },
    changedBy: {
      firstName: string;
      lastName: string;
      email: string;
      role: string;
    },
    reason?: string
  ): Promise<boolean> {
    return RoleEmailService.sendDemotionNotificationToAdmins(
      adminEmail,
      adminName,
      userData,
      changedBy,
      reason
    );
  }

  /**
   * Send AtCloud Ministry role change notification to the user
   * Simple, functional notification about ministry role changes
   */
  static async sendAtCloudRoleChangeToUser(
    userEmail: string,
    userData: {
      _id: string;
      firstName: string;
      lastName: string;
      email: string;
      oldRoleInAtCloud: string;
      newRoleInAtCloud: string;
    }
  ): Promise<boolean> {
    return RoleEmailService.sendAtCloudRoleChangeToUser(userEmail, userData);
  }

  /**
   * Send AtCloud Ministry role change notification to admins
   */
  static async sendAtCloudRoleChangeToAdmins(
    adminEmail: string,
    adminName: string,
    userData: {
      _id: string;
      firstName: string;
      lastName: string;
      email: string;
      oldRoleInAtCloud: string;
      newRoleInAtCloud: string;
    }
  ): Promise<boolean> {
    return RoleEmailService.sendAtCloudRoleChangeToAdmins(
      adminEmail,
      adminName,
      userData
    );
  }

  /**
   * Send new leader signup notification to admins
   * Pattern: Admin notification when new leader registers
   */
  static async sendNewLeaderSignupEmail(
    adminEmail: string,
    adminName: string,
    newLeaderData: {
      firstName: string;
      lastName: string;
      email: string;
      roleInAtCloud: string;
      signupDate: string;
    }
  ): Promise<boolean> {
    return RoleEmailService.sendNewLeaderSignupEmail(
      adminEmail,
      adminName,
      newLeaderData
    );
  }

  /**
   * Send co-organizer assignment notification
   * Pattern: Notification to the newly assigned co-organizer
   */
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
                <p><strong>Date & Time:</strong> ${EmailService.formatDateTimeRange(
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
      }" on ${EmailService.formatDateTimeRange(
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

  /**
   * Send event reminder notification to participants
   * Pattern: Time-sensitive reminder to event participants
   */
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
    return EventEmailService.sendEventReminderEmail(
      email,
      userName,
      eventData,
      reminderType
    );
  }

  /**
   * Bulk helper: send event reminder emails to unique recipients by email.
   * Duplicates (same email, case-insensitive) will be collapsed to a single send.
   */
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
    return EventEmailService.sendEventReminderEmailBulk(
      recipients,
      eventData,
      reminderType
    );
  }

  /**
   * Send @Cloud role invited notification to admins
   * When user changes from "No" to "Yes" for @Cloud co-worker
   */
  static async sendAtCloudRoleAssignedToAdmins(
    adminEmail: string,
    adminName: string,
    userData: {
      firstName: string;
      lastName: string;
      email: string;
      roleInAtCloud: string;
    }
  ): Promise<boolean> {
    return RoleEmailService.sendAtCloudRoleAssignedToAdmins(
      adminEmail,
      adminName,
      userData
    );
  }

  static async sendAtCloudRoleRemovedToAdmins(
    adminEmail: string,
    adminName: string,
    userData: {
      firstName: string;
      lastName: string;
      email: string;
      previousRoleInAtCloud: string;
    }
  ): Promise<boolean> {
    return RoleEmailService.sendAtCloudRoleRemovedToAdmins(
      adminEmail,
      adminName,
      userData
    );
  }

  /**
   * Send new @Cloud co-worker signup notification to admins
   * When new user signs up with @Cloud co-worker role
   */
  static async sendNewAtCloudLeaderSignupToAdmins(
    adminEmail: string,
    adminName: string,
    userData: {
      firstName: string;
      lastName: string;
      email: string;
      roleInAtCloud: string;
    }
  ): Promise<boolean> {
    const userName = `${userData.firstName} ${userData.lastName}`.trim();

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New @Cloud Co-worker Signup - Admin Notification</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .admin-alert { background: #e2e3f1; border-left: 4px solid #6f42c1; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .user-details { background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .button { display: inline-block; background: #6f42c1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 New @Cloud Co-worker Signup</h1>
              <p>Administrative Oversight Notification</p>
            </div>
            <div class="content">
              <h2>Hello ${adminName},</h2>
              <div class="admin-alert">
                <h3>New @Cloud Co-worker Registration</h3>
                <p>A new user has signed up as an @Cloud co-worker.</p>
              </div>
              <div class="user-details">
                <h4>New User Details</h4>
                <p><strong>Name:</strong> ${userName}</p>
                <p><strong>Email:</strong> ${userData.email}</p>
                <p><strong>@Cloud Role:</strong> ${userData.roleInAtCloud}</p>
                <p><strong>Status:</strong> New @Cloud Co-worker</p>
              </div>
              <div style="text-align: center;">
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/admin/users" class="button">
                  Review in Admin Dashboard
                </a>
              </div>
              <p>Please welcome the new leader and provide ministry onboarding as appropriate.</p>
              <p>Best regards,<br>@Cloud Ministry System</p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry | Administrative Oversight</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: adminEmail,
      subject: `🎉 New @Cloud Co-worker Signup - ${userName}`,
      html,
      text: `New @Cloud Co-worker Signup: ${userName} (${userData.email}) has signed up as an @Cloud co-worker with role: ${userData.roleInAtCloud}`,
    });
  }

  // Simple event role lifecycle emails (assignment / removal / move)
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
    return EventEmailService.sendEventRoleAssignedEmail(to, data);
  }

  static async sendEventRoleRemovedEmail(
    to: string,
    data: { event: any; user: any; roleName: string; actor: any }
  ): Promise<boolean> {
    return EventEmailService.sendEventRoleRemovedEmail(to, data);
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
    return EventEmailService.sendEventRoleMovedEmail(to, data);
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
    return EventEmailService.sendEventRoleAssignmentRejectedEmail(to, data);
  }

  /**
   * Send purchase confirmation email after successful program enrollment
   */
  static async sendPurchaseConfirmationEmail(params: {
    email: string;
    name: string;
    orderNumber: string;
    programTitle: string;
    programType: string;
    purchaseDate: Date;
    fullPrice: number;
    finalPrice: number;
    classRepDiscount?: number;
    earlyBirdDiscount?: number;
    isClassRep: boolean;
    isEarlyBird: boolean;
    receiptUrl: string;
  }): Promise<boolean> {
    const {
      email,
      name,
      orderNumber,
      programTitle,
      programType,
      purchaseDate,
      fullPrice,
      finalPrice,
      classRepDiscount = 0,
      earlyBirdDiscount = 0,
      isClassRep,
      isEarlyBird,
      receiptUrl,
    } = params;

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const formattedDate = new Date(purchaseDate).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const formatCurrency = (amount: number) => `$${(amount / 100).toFixed(2)}`;

    const totalSavings = classRepDiscount + earlyBirdDiscount;
    const hasDiscounts = totalSavings > 0;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Purchase Confirmation - @Cloud Ministry</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #9333ea 0%, #7e22ce 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .success-icon { font-size: 48px; margin-bottom: 10px; }
            .order-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #9333ea; }
            .order-detail { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
            .order-detail:last-child { border-bottom: none; }
            .label { color: #666; font-weight: 600; }
            .value { color: #333; font-weight: normal; }
            .program-info { background: #f3e8ff; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .pricing-table { width: 100%; margin: 20px 0; }
            .pricing-row { display: flex; justify-content: space-between; padding: 8px 0; }
            .pricing-total { border-top: 2px solid #333; padding-top: 10px; margin-top: 10px; font-weight: bold; font-size: 18px; }
            .discount { color: #059669; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; margin-left: 8px; }
            .badge-blue { background: #dbeafe; color: #1e40af; }
            .badge-amber { background: #fef3c7; color: #92400e; }
            .button { display: inline-block; padding: 12px 30px; background: #9333ea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .button:hover { background: #7e22ce; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; padding: 20px; }
            .support-box { background: #fff7ed; border: 1px solid #fed7aa; padding: 15px; border-radius: 8px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="success-icon">✓</div>
              <h1 style="margin: 0;">Thank You for Your Enrollment!</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Your payment was successful</p>
            </div>
            <div class="content">
              <h2>Hello ${name},</h2>
              <p>Congratulations! You have successfully enrolled in our program. We're excited to have you join us on this journey of growth and learning.</p>
              
              <div class="program-info">
                <h3 style="margin-top: 0; color: #7e22ce;">${programTitle}</h3>
                <p style="margin: 5px 0; color: #666;">${programType}</p>
              </div>

              <div class="order-box">
                <div class="order-detail">
                  <span class="label">Order Number:</span>
                  <span class="value">${orderNumber}</span>
                </div>
                <div class="order-detail">
                  <span class="label">Purchase Date:</span>
                  <span class="value">${formattedDate}</span>
                </div>
                <div class="order-detail">
                  <span class="label">Amount Paid:</span>
                  <span class="value">${formatCurrency(finalPrice)}</span>
                </div>
              </div>

              ${
                hasDiscounts
                  ? `
              <div class="pricing-table">
                <h3>Payment Summary</h3>
                <div class="pricing-row">
                  <span>Program Enrollment</span>
                  <span>${formatCurrency(fullPrice)}</span>
                </div>
                ${
                  isClassRep && classRepDiscount > 0
                    ? `
                <div class="pricing-row discount">
                  <span>Class Representative Discount <span class="badge badge-blue">Class Rep</span></span>
                  <span>-${formatCurrency(classRepDiscount)}</span>
                </div>
                `
                    : ""
                }
                ${
                  isEarlyBird && earlyBirdDiscount > 0
                    ? `
                <div class="pricing-row discount">
                  <span>Early Bird Discount <span class="badge badge-amber">Early Bird</span></span>
                  <span>-${formatCurrency(earlyBirdDiscount)}</span>
                </div>
                `
                    : ""
                }
                <div class="pricing-row pricing-total">
                  <span>Total Paid</span>
                  <span>${formatCurrency(finalPrice)}</span>
                </div>
                <div class="pricing-row" style="color: #059669; font-weight: 600; font-size: 14px;">
                  <span>You Saved</span>
                  <span>${formatCurrency(totalSavings)}</span>
                </div>
              </div>
              `
                  : ""
              }

              <div style="text-align: center;">
                <a href="${receiptUrl}" class="button">View Receipt</a>
              </div>

              <div class="support-box">
                <h4 style="margin-top: 0; color: #92400e;">What's Next?</h4>
                <ul style="margin: 10px 0; padding-left: 20px; color: #666;">
                  <li>Access all events within this program from your dashboard</li>
                  <li>Connect with mentors and fellow participants</li>
                  <li>Check your email for program updates and reminders</li>
                  <li>Download your receipt for your records</li>
                </ul>
              </div>

              <p><strong>Questions?</strong> If you have any questions about your enrollment or the program, please don't hesitate to reach out to our support team.</p>
              
              <p>Blessings on your journey,<br><strong>The @Cloud Ministry Team</strong></p>
            </div>
            <div class="footer">
              <p><strong>@Cloud Ministry</strong> | Building Community Through Faith</p>
              <p>Support: <a href="mailto:atcloudministry@gmail.com" style="color: #9333ea;">atcloudministry@gmail.com</a></p>
              <p style="font-size: 12px; color: #999; margin-top: 15px;">
                This is a confirmation email for order ${orderNumber}. Please save this email for your records.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Thank You for Your Enrollment!

Hello ${name},

You have successfully enrolled in:
${programTitle} (${programType})

Order Details:
- Order Number: ${orderNumber}
- Purchase Date: ${formattedDate}
- Amount Paid: ${formatCurrency(finalPrice)}
${
  hasDiscounts
    ? `\nPayment Breakdown:\n- Program Enrollment: ${formatCurrency(fullPrice)}`
    : ""
}
${
  isClassRep && classRepDiscount > 0
    ? `- Class Representative Discount: -${formatCurrency(classRepDiscount)}`
    : ""
}
${
  isEarlyBird && earlyBirdDiscount > 0
    ? `- Early Bird Discount: -${formatCurrency(earlyBirdDiscount)}`
    : ""
}
${
  hasDiscounts
    ? `- Total Paid: ${formatCurrency(
        finalPrice
      )}\n- You Saved: ${formatCurrency(totalSavings)}`
    : ""
}

View your receipt online: ${receiptUrl}

What's Next?
- Access all events within this program from your dashboard
- Connect with mentors and fellow participants
- Check your email for program updates and reminders
- Download your receipt for your records

If you have any questions, please contact us at atcloudministry@gmail.com

Blessings,
The @Cloud Ministry Team
    `.trim();

    log.info(
      `Sending purchase confirmation email to ${email} for order ${orderNumber}`
    );

    return this.sendEmail({
      to: email,
      subject: `Enrollment Confirmed: ${programTitle} - Order ${orderNumber}`,
      html,
      text,
    });
  }

  /**
   * Send staff promo code notification to user
   */
  static async sendStaffPromoCodeEmail(params: {
    recipientEmail: string;
    recipientName: string;
    promoCode: string;
    discountPercent: number;
    allowedPrograms?: string;
    expiresAt?: string;
    createdBy: string;
  }): Promise<boolean> {
    const {
      recipientEmail,
      recipientName,
      promoCode,
      discountPercent,
      allowedPrograms,
      expiresAt,
      createdBy,
    } = params;

    const escapeHtml = (s: string) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const frontend = process.env.FRONTEND_URL || "http://localhost:3000";
    const promoCodesUrl = `${frontend}/dashboard/promo-codes`;

    const expiryText = expiresAt
      ? `This code expires on ${new Date(expiresAt).toLocaleDateString(
          "en-US",
          {
            year: "numeric",
            month: "long",
            day: "numeric",
          }
        )}.`
      : "This code never expires.";

    const programText = allowedPrograms
      ? `for ${allowedPrograms}`
      : "for all programs";

    const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You've Received a Staff Access Code - @Cloud Ministry</title>
    <style>
      body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6; }
      .container { max-width: 600px; margin: 0 auto; background: white; }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; }
      .header h1 { color: white; margin: 0; font-size: 28px; }
      .content { padding: 40px 30px; }
      .code-card { background: #f9fafb; border: 2px dashed #9333ea; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; }
      .code { font-family: 'Courier New', monospace; font-size: 32px; font-weight: bold; color: #9333ea; letter-spacing: 2px; margin: 15px 0; }
      .details { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 25px 0; }
      .details h3 { margin: 0 0 15px 0; color: #92400e; font-size: 18px; }
      .details p { margin: 8px 0; color: #78350f; }
      .cta-button { display: inline-block; background: #9333ea; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
      .cta-button:hover { background: #7e22ce; }
      .footer { background: #f9fafb; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; }
      .emoji { font-size: 48px; margin-bottom: 20px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="emoji">🎁</div>
        <h1>You've Received a Staff Access Code!</h1>
      </div>
      
      <div class="content">
        <p>Hi ${escapeHtml(recipientName)},</p>
        
        <p>Great news! You've been granted a <strong>${discountPercent}% discount code</strong> ${programText} by ${escapeHtml(
      createdBy
    )}.</p>
        
        <div class="code-card">
          <div style="color: #6b7280; font-size: 14px; margin-bottom: 10px;">Your Promo Code</div>
          <div class="code">${escapeHtml(promoCode)}</div>
          <div style="color: #6b7280; font-size: 14px; margin-top: 10px;">Copy this code to use at checkout</div>
        </div>
        
        <div class="details">
          <h3>📋 Code Details</h3>
          <p><strong>Discount:</strong> ${discountPercent}% off</p>
          <p><strong>Valid for:</strong> ${
            allowedPrograms || "All programs"
          }</p>
          <p><strong>Status:</strong> ${expiryText}</p>
        </div>
        
        <p style="margin-top: 30px;">Ready to use your code? View it anytime in your promo codes dashboard:</p>
        
        <div style="text-align: center;">
          <a href="${promoCodesUrl}" class="cta-button" style="display: inline-block; background: #9333ea; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin: 20px 0;">View My Promo Codes →</a>
        </div>
        
        <p style="margin-top: 30px; padding-top: 30px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
          <strong>How to use:</strong> When enrolling in a program, enter this code at checkout to receive your discount.
        </p>
      </div>
      
      <div class="footer">
        <p>This is an automated message from @Cloud Ministry.</p>
        <p>If you have any questions, please contact atcloudministry@gmail.com</p>
        <p style="margin-top: 20px;">
          <a href="${promoCodesUrl}" style="color: #9333ea; text-decoration: none;">Manage My Promo Codes</a>
        </p>
      </div>
    </div>
  </body>
</html>
    `.trim();

    const text = `
You've Received a Staff Access Code!

Hi ${recipientName},

Great news! You've been granted a ${discountPercent}% discount code ${programText} by ${createdBy}.

Your Promo Code: ${promoCode}

Code Details:
- Discount: ${discountPercent}% off
- Valid for: ${allowedPrograms || "All programs"}
- Status: ${expiryText}

View your promo codes: ${promoCodesUrl}

How to use: When enrolling in a program, enter this code at checkout to receive your discount.

Blessings,
The @Cloud Ministry Team
    `.trim();

    log.info(
      `Sending staff promo code email to ${recipientEmail} with code ${promoCode}`
    );

    return this.sendEmail({
      to: recipientEmail,
      subject: `🎁 You've Received a ${discountPercent}% Discount Code!`,
      html,
      text,
    });
  }

  /**
   * Send promo code deactivation notification to user
   */
  static async sendPromoCodeDeactivatedEmail(params: {
    recipientEmail: string;
    recipientName: string;
    promoCode: string;
    discountPercent: number;
    allowedPrograms?: string;
    deactivatedBy: string;
  }): Promise<boolean> {
    const {
      recipientEmail,
      recipientName,
      promoCode,
      discountPercent,
      allowedPrograms,
      deactivatedBy,
    } = params;

    const escapeHtml = (s: string) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const frontend = process.env.FRONTEND_URL || "http://localhost:3000";
    const promoCodesUrl = `${frontend}/dashboard/promo-codes`;

    const programText = allowedPrograms
      ? `for ${allowedPrograms}`
      : "for all programs";

    const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Promo Code Deactivated - @Cloud Ministry</title>
    <style>
      body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6; }
      .container { max-width: 600px; margin: 0 auto; background: white; }
      .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 40px 20px; text-align: center; }
      .header h1 { color: white; margin: 0; font-size: 28px; }
      .content { padding: 40px 30px; }
      .code-card { background: #fef2f2; border: 2px solid #ef4444; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; }
      .code { font-family: 'Courier New', monospace; font-size: 32px; font-weight: bold; color: #dc2626; letter-spacing: 2px; margin: 15px 0; text-decoration: line-through; }
      .details { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 25px 0; }
      .details h3 { margin: 0 0 15px 0; color: #92400e; font-size: 18px; }
      .details p { margin: 8px 0; color: #78350f; }
      .cta-button { display: inline-block; background: #ef4444; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
      .cta-button:hover { background: #dc2626; }
      .footer { background: #f9fafb; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; }
      .emoji { font-size: 48px; margin-bottom: 20px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="emoji">⛔</div>
        <h1>Promo Code Deactivated</h1>
      </div>
      
      <div class="content">
        <p>Hi ${escapeHtml(recipientName)},</p>
        
        <p>Your promo code has been <strong>deactivated</strong> by ${escapeHtml(
          deactivatedBy
        )}. This code can no longer be used for enrollment.</p>
        
        <div class="code-card">
          <div style="color: #6b7280; font-size: 14px; margin-bottom: 10px;">Deactivated Code</div>
          <div class="code">${escapeHtml(promoCode)}</div>
          <div style="color: #dc2626; font-size: 14px; margin-top: 10px; font-weight: 600;">⚠️ This code is no longer active</div>
        </div>
        
        <div class="details">
          <h3>📋 Code Details</h3>
          <p><strong>Discount:</strong> ${discountPercent}% off</p>
          <p><strong>Valid for:</strong> ${
            allowedPrograms || "All programs"
          }</p>
          <p><strong>Status:</strong> <span style="color: #dc2626; font-weight: 600;">Deactivated</span></p>
        </div>
        
        <p style="margin-top: 30px;">If you have questions about this deactivation, please contact the administrator.</p>
        
        <div style="text-align: center;">
          <a href="${promoCodesUrl}" class="cta-button" style="display: inline-block; background: #ef4444; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin: 20px 0;">View My Promo Codes →</a>
        </div>
      </div>
      
      <div class="footer">
        <p>This is an automated message from @Cloud Ministry.</p>
        <p>If you have any questions, please contact atcloudministry@gmail.com</p>
        <p style="margin-top: 20px;">
          <a href="${promoCodesUrl}" style="color: #ef4444; text-decoration: none;">Manage My Promo Codes</a>
        </p>
      </div>
    </div>
  </body>
</html>
    `.trim();

    const text = `
Promo Code Deactivated

Hi ${recipientName},

Your promo code has been deactivated by ${deactivatedBy}. This code can no longer be used for enrollment.

Deactivated Code: ${promoCode}

Code Details:
- Discount: ${discountPercent}% off
- Valid for: ${allowedPrograms || "All programs"}
- Status: Deactivated

If you have questions about this deactivation, please contact the administrator.

View your promo codes: ${promoCodesUrl}

@Cloud Ministry Team
    `.trim();

    log.info(
      `Sending promo code deactivation email to ${recipientEmail} for code ${promoCode}`
    );

    return this.sendEmail({
      to: recipientEmail,
      subject: `⛔ Your Promo Code ${promoCode} Has Been Deactivated`,
      html,
      text,
    });
  }

  /**
   * Send promo code reactivation notification to user
   */
  static async sendPromoCodeReactivatedEmail(params: {
    recipientEmail: string;
    recipientName: string;
    promoCode: string;
    discountPercent: number;
    allowedPrograms?: string;
    expiresAt?: string;
    reactivatedBy: string;
  }): Promise<boolean> {
    const {
      recipientEmail,
      recipientName,
      promoCode,
      discountPercent,
      allowedPrograms,
      expiresAt,
      reactivatedBy,
    } = params;

    const escapeHtml = (s: string) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const frontend = process.env.FRONTEND_URL || "http://localhost:3000";
    const promoCodesUrl = `${frontend}/dashboard/promo-codes`;

    const expiryText = expiresAt
      ? `This code expires on ${new Date(expiresAt).toLocaleDateString(
          "en-US",
          {
            year: "numeric",
            month: "long",
            day: "numeric",
          }
        )}.`
      : "This code never expires.";

    const programText = allowedPrograms
      ? `for ${allowedPrograms}`
      : "for all programs";

    const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Promo Code Reactivated - @Cloud Ministry</title>
    <style>
      body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6; }
      .container { max-width: 600px; margin: 0 auto; background: white; }
      .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 20px; text-align: center; }
      .header h1 { color: white; margin: 0; font-size: 28px; }
      .content { padding: 40px 30px; }
      .code-card { background: #f0fdf4; border: 2px solid #10b981; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; }
      .code { font-family: 'Courier New', monospace; font-size: 32px; font-weight: bold; color: #059669; letter-spacing: 2px; margin: 15px 0; }
      .details { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 25px 0; }
      .details h3 { margin: 0 0 15px 0; color: #92400e; font-size: 18px; }
      .details p { margin: 8px 0; color: #78350f; }
      .cta-button { display: inline-block; background: #10b981; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
      .cta-button:hover { background: #059669; }
      .footer { background: #f9fafb; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; }
      .emoji { font-size: 48px; margin-bottom: 20px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="emoji">✅</div>
        <h1>Promo Code Reactivated!</h1>
      </div>
      
      <div class="content">
        <p>Hi ${escapeHtml(recipientName)},</p>
        
        <p>Good news! Your promo code has been <strong>reactivated</strong> by ${escapeHtml(
          reactivatedBy
        )}. You can now use this code for enrollment.</p>
        
        <div class="code-card">
          <div style="color: #6b7280; font-size: 14px; margin-bottom: 10px;">Your Active Promo Code</div>
          <div class="code">${escapeHtml(promoCode)}</div>
          <div style="color: #059669; font-size: 14px; margin-top: 10px; font-weight: 600;">✓ Ready to use</div>
        </div>
        
        <div class="details">
          <h3>📋 Code Details</h3>
          <p><strong>Discount:</strong> ${discountPercent}% off</p>
          <p><strong>Valid for:</strong> ${
            allowedPrograms || "All programs"
          }</p>
          <p><strong>Status:</strong> ${expiryText}</p>
        </div>
        
        <p style="margin-top: 30px;">Ready to use your code? View it anytime in your promo codes dashboard:</p>
        
        <div style="text-align: center;">
          <a href="${promoCodesUrl}" class="cta-button" style="display: inline-block; background: #10b981; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin: 20px 0;">View My Promo Codes →</a>
        </div>
        
        <p style="margin-top: 30px; padding-top: 30px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
          <strong>How to use:</strong> When enrolling in a program, enter this code at checkout to receive your discount.
        </p>
      </div>
      
      <div class="footer">
        <p>This is an automated message from @Cloud Ministry.</p>
        <p>If you have any questions, please contact atcloudministry@gmail.com</p>
        <p style="margin-top: 20px;">
          <a href="${promoCodesUrl}" style="color: #10b981; text-decoration: none;">Manage My Promo Codes</a>
        </p>
      </div>
    </div>
  </body>
</html>
    `.trim();

    const text = `
Promo Code Reactivated!

Hi ${recipientName},

Good news! Your promo code has been reactivated by ${reactivatedBy}. You can now use this code for enrollment.

Your Promo Code: ${promoCode}

Code Details:
- Discount: ${discountPercent}% off
- Valid for: ${allowedPrograms || "All programs"}
- Status: ${expiryText}

View your promo codes: ${promoCodesUrl}

How to use: When enrolling in a program, enter this code at checkout to receive your discount.

@Cloud Ministry Team
    `.trim();

    log.info(
      `Sending promo code reactivation email to ${recipientEmail} for code ${promoCode}`
    );

    return this.sendEmail({
      to: recipientEmail,
      subject: `✅ Your Promo Code ${promoCode} Has Been Reactivated!`,
      html,
      text,
    });
  }
}
