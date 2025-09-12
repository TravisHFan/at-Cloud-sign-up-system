import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { createLogger } from "../../services/LoggerService";

dotenv.config();

const log = createLogger("EmailService");

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: nodemailer.SendMailOptions["attachments"]; // support inline images and files
}

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
  private static transporter: nodemailer.Transporter;
  // In-memory dedup cache: key -> lastSentAt (ms)
  private static dedupeCache: Map<string, number> = new Map();

  /**
   * Test-only: clear internal dedupe cache to avoid cross-test interference.
   * Safe to call in any environment; no effect on behavior other than cache state.
   */
  static __clearDedupeCacheForTests(): void {
    try {
      this.dedupeCache.clear();
    } catch {}
  }

  private static getDedupTtlMs(): number {
    const n = Number(process.env.EMAIL_DEDUP_TTL_MS || "120000");
    return Number.isFinite(n) && n > 0 ? n : 120000; // default 2 minutes
  }

  private static simpleHash(input: string): string {
    // djb2-like simple hash; deterministic and fast
    let hash = 5381;
    for (let i = 0; i < input.length; i++) {
      hash = (hash * 33) ^ input.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
  }

  private static makeDedupKey(options: EmailOptions): string {
    const email = (options.to || "").trim().toLowerCase();
    const subject = (options.subject || "").trim();
    const bodySig = this.simpleHash(`${options.html}\n${options.text || ""}`);
    return `${email}|${subject}|${bodySig}`;
  }

  private static purgeExpiredDedup(now: number, ttl: number) {
    if (this.dedupeCache.size === 0) return;
    for (const [k, ts] of this.dedupeCache.entries()) {
      if (now - ts > ttl) this.dedupeCache.delete(k);
    }
  }

  private static isDedupeEnabled(): boolean {
    // Explicit opt-in via env to avoid surprising behavior in tests/dev
    return process.env.EMAIL_DEDUP_ENABLE === "true";
  }

  private static getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      // Check if real SMTP credentials are configured
      const hasRealCredentials =
        process.env.SMTP_USER &&
        process.env.SMTP_PASS &&
        !process.env.SMTP_USER.includes("your-email") &&
        !process.env.SMTP_PASS.includes("your-app-password");

      if (process.env.NODE_ENV === "production" && hasRealCredentials) {
        // Production email configuration
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || "587"),
          secure: process.env.SMTP_SECURE === "true",
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
      } else if (hasRealCredentials) {
        // Development with real credentials
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || "smtp.gmail.com",
          port: parseInt(process.env.SMTP_PORT || "587"),
          secure: false, // Use TLS
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
      } else {
        // Development: Use console logging instead of real email
        console.log(
          "🔧 Development mode: Email service will use console logging"
        );
        // Structured log alongside console for visibility
        try {
          log.info("Development mode: email service using console logging");
        } catch {}
        this.transporter = nodemailer.createTransport({
          jsonTransport: true, // This will just return JSON instead of sending
        });
      }
    }
    return this.transporter;
  }

  static async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      // Global duplicate suppression (opt-in): avoid sending the exact same email payload
      // to the same recipient multiple times within a short TTL window.
      if (this.isDedupeEnabled()) {
        const now = Date.now();
        const ttl = this.getDedupTtlMs();
        this.purgeExpiredDedup(now, ttl);
        const dedupKey = this.makeDedupKey(options);
        const last = this.dedupeCache.get(dedupKey);
        if (last && now - last < ttl) {
          try {
            log.info("Duplicate email suppressed by dedupe cache", undefined, {
              to: options.to,
              subject: options.subject,
            });
          } catch {}
          return true; // treat as success
        }
        this.dedupeCache.set(dedupKey, now);
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

      const transporter = this.getTransporter();

      const mailOptions: nodemailer.SendMailOptions = {
        from:
          process.env.EMAIL_FROM || '"@Cloud Ministry" <noreply@atcloud.org>',
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      };
      if (options.replyTo) {
        mailOptions.replyTo = options.replyTo;
      }
      if (options.attachments && options.attachments.length) {
        mailOptions.attachments = options.attachments;
      }

      const info = await transporter.sendMail(mailOptions);

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

  // ===== Shared Date-Time Formatting Helpers =====
  private static normalizeTimeTo24h(time: string): string {
    if (!time) return "00:00";
    const t = time.trim();
    const ampm = /(am|pm)$/i;
    if (!ampm.test(t)) {
      return t;
    }
    const match = t.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
    if (!match) return t;
    let [_, hh, mm, ap] = match;
    let h = parseInt(hh, 10);
    if (/pm/i.test(ap) && h !== 12) h += 12;
    if (/am/i.test(ap) && h === 12) h = 0;
    const h2 = h.toString().padStart(2, "0");
    return `${h2}:${mm}`;
  }

  private static buildDate(
    date: string,
    time: string,
    timeZone?: string
  ): Date {
    const t24 = this.normalizeTimeTo24h(time);
    if (!timeZone) {
      // Preserve existing behavior when no timezone is provided (assume local system tz)
      return new Date(`${date}T${t24}`);
    }

    // When a timezone is provided, interpret the provided date/time as local wall time
    // in that timezone and convert it to an absolute Date. This avoids shifting caused
    // by using the system timezone as the base.
    try {
      const [yStr, mStr, dStr] = date.split("-");
      const [hhStr, mmStr] = t24.split(":");
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const d = parseInt(dStr, 10);
      const hh = parseInt(hhStr || "0", 10);
      const mm = parseInt(mmStr || "0", 10);

      // Start with the UTC timestamp for the intended wall time components
      const utcTs = Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);

      const dtf = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      const parts = dtf.formatToParts(new Date(utcTs));
      const get = (type: string) =>
        parts.find((p) => p.type === type)?.value || "0";
      const zoneY = parseInt(get("year"), 10);
      const zoneM = parseInt(get("month"), 10);
      const zoneD = parseInt(get("day"), 10);
      const zoneH = parseInt(get("hour"), 10);
      const zoneMin = parseInt(get("minute"), 10);
      const zoneS = parseInt(get("second"), 10);

      // zoneTs is what the formatter says the wall time would be for the given UTC instant
      const zoneTs = Date.UTC(
        zoneY,
        (zoneM || 1) - 1,
        zoneD || 1,
        zoneH || 0,
        zoneMin || 0,
        zoneS || 0,
        0
      );
      const offset = zoneTs - utcTs; // difference between zone local time and UTC for that instant

      // Adjust the UTC timestamp by the offset to get the absolute time that corresponds
      // to the intended wall time in the given timezone (handles DST correctly)
      return new Date(utcTs - offset);
    } catch {
      // Fallback to previous behavior if anything goes wrong
      return new Date(`${date}T${t24}`);
    }
  }

  private static formatDateTime(
    date: string,
    time: string,
    timeZone?: string
  ): string {
    const d = this.buildDate(date, time, timeZone);
    const opts: Intl.DateTimeFormatOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      ...(timeZone ? { timeZone, timeZoneName: "short" } : {}),
    };
    try {
      return new Intl.DateTimeFormat("en-US", opts).format(d);
    } catch {
      return d.toLocaleString("en-US", opts);
    }
  }

  private static formatTime(
    time: string,
    timeZone?: string,
    date?: string
  ): string {
    const t24 = this.normalizeTimeTo24h(time);
    const [hours, minutes] = t24.split(":");

    // Use the provided date if available, otherwise fall back to current date
    const temp = date ? this.buildDate(date, time, timeZone) : new Date();
    if (!date) {
      temp.setHours(parseInt(hours || "0"), parseInt(minutes || "0"), 0, 0);
    }

    const opts: Intl.DateTimeFormatOptions = {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      ...(timeZone ? { timeZone, timeZoneName: "short" } : {}),
    };
    try {
      return new Intl.DateTimeFormat("en-US", opts).format(temp);
    } catch {
      return temp.toLocaleString("en-US", opts);
    }
  }

  private static formatDateTimeRange(
    date: string,
    startTime: string,
    endTime?: string,
    endDate?: string,
    timeZone?: string
  ): string {
    const multiDay = !!endDate && endDate !== date;
    const left = this.formatDateTime(date, startTime, timeZone);
    if (!endTime) return left;
    if (multiDay) {
      const right = this.formatDateTime(endDate as string, endTime, timeZone);
      return `${left} - ${right}`;
    }
    const right = this.formatTime(endTime, timeZone, date);
    return `${left} - ${right}`;
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
        EmailService.sendEventNotificationEmail(
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

  static async sendVerificationEmail(
    email: string,
    name: string,
    verificationToken: string
  ): Promise<boolean> {
    const verificationUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/verify-email/${verificationToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email - @Cloud Ministry</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to @Cloud Ministry!</h1>
            </div>
            <div class="content">
              <h2>Hello ${name},</h2>
              <p>Thank you for joining @Cloud Ministry! We're excited to have you as part of our community.</p>
              <p>To complete your registration and start participating in our events, please verify your email address by clicking the button below:</p>
              <div style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify My Email</a>
              </div>
              <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
              <p><a href="${verificationUrl}">${verificationUrl}</a></p>
              <p>This verification link will expire in 24 hours for security purposes.</p>
              <p>If you didn't create an account with @Cloud Ministry, please ignore this email.</p>
              <p>Blessings,<br>The @Cloud Ministry Team</p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry | Building Community Through Faith</p>
              <p>If you have any questions, please contact us at support@atcloud.org</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: "Welcome to @Cloud Ministry - Please Verify Your Email",
      html,
      text: `Welcome to @Cloud Ministry! Please verify your email by visiting: ${verificationUrl}`,
    });
  }

  static async sendPasswordResetEmail(
    email: string,
    name: string,
    resetToken: string
  ): Promise<boolean> {
    const resetUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/reset-password/${resetToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset - @Cloud Ministry</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #f5576c; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <h2>Hello ${name},</h2>
              <p>We received a request to reset your password for your @Cloud Ministry account.</p>
              <p>If you requested this password reset, please click the button below to create a new password:</p>
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset My Password</a>
              </div>
              <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
              <p><a href="${resetUrl}">${resetUrl}</a></p>
              <p><strong>Important:</strong> This reset link will expire in 10 minutes for security purposes.</p>
              <p>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
              <p>Blessings,<br>The @Cloud Ministry Team</p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry | Building Community Through Faith</p>
              <p>If you have any questions, please contact us at support@atcloud.org</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: "Password Reset Request - @Cloud Ministry",
      html,
      text: `Password reset requested. Please visit: ${resetUrl} (expires in 10 minutes)`,
    });
  }

  static async sendPasswordChangeRequestEmail(
    email: string,
    name: string,
    confirmToken: string
  ): Promise<boolean> {
    const confirmUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/change-password/confirm/${confirmToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Change Request - @Cloud Ministry</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #4facfe; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Change Request</h1>
            </div>
            <div class="content">
              <p>Hello ${name},</p>
              <p>We received a request to change your password for your @Cloud Ministry account.</p>
              
              <div class="warning">
                <strong>Security Notice:</strong> If you didn't request this password change, please ignore this email. Your password will remain unchanged.
              </div>
              
              <p>To confirm and complete your password change, click the button below:</p>
              <p style="text-align: center;">
                <a href="${confirmUrl}" class="button">Confirm Password Change</a>
              </p>
              <p>Or copy and paste this link into your browser:<br>
                <a href="${confirmUrl}">${confirmUrl}</a>
              </p>
              
              <p><strong>This link will expire in 10 minutes for security.</strong></p>
              
              <div class="footer">
                <p>This is an automated message from @Cloud Ministry.<br>
                If you need help, please contact our support team.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: "Password Change Request - @Cloud Ministry",
      html,
      text: `Password change requested. Please confirm by visiting: ${confirmUrl} (expires in 10 minutes)`,
    });
  }

  // ===== Guest Email Helpers =====
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
              <h1>You're Registered as a Guest</h1>
            </div>
            <div class="content">
              <p>Hello ${params.guestName},</p>
              <p>Thank you for registering as a guest for <strong>${
                params.event.title
              }</strong>.</p>
              ${dateStr ? `<p><strong>When:</strong> ${dateStr}</p>` : ""}
              ${
                params.event.location
                  ? `<p><strong>Location:</strong> ${params.event.location}</p>`
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
              <p>You can view details or manage your registration here:</p>
              <p style="text-align:center"><a href="${manageUrl}" class="button">View My Registration</a></p>
              <p>If you have any questions, please reply to this email.</p>
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

    return this.sendEmail({
      to: params.guestEmail,
      subject: `✅ You're registered for ${params.event.title}`,
      html,
      text,
    });
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
    const actorName = `${deactivatedBy.firstName || ""} ${
      deactivatedBy.lastName || ""
    }`.trim();

    const subject = "Account Deactivation Notification";
    const plainText = `Hello ${userName},\n\nWe wanted to let you know that your account has been deactivated by ${deactivatedBy.role} ${actorName}.\n\nIf you'd like your access restored, our Administrators are happy to help—please reach out to an Admin to request reactivation.\n\nThank you for your understanding.\n\nBest regards,\n\n@Cloud Marketplace Ministry`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #6c757d 0%, #495057 100%); color: white; padding: 24px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { margin: 0; font-size: 22px; }
            .content { background: #f9f9f9; padding: 28px; border-radius: 0 0 10px 10px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Account Deactivation Notification</h1>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              <p>We wanted to let you know that your account has been deactivated by <strong>${deactivatedBy.role}</strong> <strong>${actorName}</strong>.</p>
              <p>If you'd like your access restored, our Administrators are happy to help—please reach out to an Admin to request reactivation.</p>
              <p>Thank you for your understanding.</p>
              <p>Best regards,</p>
              <p><strong>@Cloud Marketplace Ministry</strong></p>
            </div>
            <div class="footer">
              <p>@Cloud Marketplace Ministry</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({ to: userEmail, subject, html, text: plainText });
  }

  /**
   * Send account reactivation email to the user (no system message needed)
   */
  static async sendAccountReactivationEmail(
    userEmail: string,
    userName: string,
    reactivatedBy: { role: string; firstName?: string; lastName?: string }
  ): Promise<boolean> {
    const actorName = `${reactivatedBy.firstName || ""} ${
      reactivatedBy.lastName || ""
    }`.trim();

    const subject = "Your @Cloud Account Has Been Reactivated";
    const plainText = `Hello ${userName},\n\nGood news—your account has been reactivated by ${reactivatedBy.role} ${actorName}. You can log in to your account now.\n\nWelcome back!\n\nBest regards,\n\n@Cloud Marketplace Ministry`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 24px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { margin: 0; font-size: 22px; }
            .content { background: #f9f9f9; padding: 28px; border-radius: 0 0 10px 10px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            .button { display: inline-block; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 6px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Your Account Has Been Reactivated</h1>
            </div>
            <div class="content">
              <p>Hello ${userName},</p>
              <p>Good news—your account has been reactivated by <strong>${
                reactivatedBy.role
              }</strong> <strong>${actorName}</strong>.</p>
              <p>You can log in to your account now.</p>
              <p style="text-align:center;">
                <a class="button" href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/login">Log In</a>
              </p>
              <p>Welcome back!</p>
              <p>Best regards,</p>
              <p><strong>@Cloud Marketplace Ministry</strong></p>
            </div>
            <div class="footer">
              <p>@Cloud Marketplace Ministry</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({ to: userEmail, subject, html, text: plainText });
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
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Changed Successfully - @Cloud Ministry</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #00b894 0%, #00cec9 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .security-tip { background: #e3f2fd; border: 1px solid #bbdefb; padding: 15px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Changed Successfully</h1>
            </div>
            <div class="content">
              <p>Hello ${name},</p>
              
              <div class="success">
                <strong>✅ Success!</strong> Your password has been changed successfully.
              </div>
              
              <p>Your @Cloud Ministry account password was updated on ${new Date().toLocaleString()}.</p>
              
              <div class="security-tip">
                <strong>Security Reminder:</strong> If you didn't make this change, please contact our support team immediately and consider securing your account.
              </div>
              
              <p>You can now use your new password to log in to your account.</p>
              
              <div class="footer">
                <p>This is an automated security notification from @Cloud Ministry.<br>
                If you need help, please contact our support team.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: "Password Changed Successfully - @Cloud Ministry",
      html,
      text: `Your @Cloud Ministry password was changed successfully on ${new Date().toLocaleString()}. If you didn't make this change, please contact support immediately.`,
    });
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
                    return EmailService.formatDateTimeRange(
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
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to @Cloud Ministry</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to @Cloud Ministry!</h1>
            </div>
            <div class="content">
              <h2>Hello ${name},</h2>
              <p>Your email has been verified and your account is now active! Welcome to the @Cloud Ministry community.</p>
              <p>Here's what you can do now:</p>
              <ul>
                <li>Browse and sign up for upcoming events</li>
                <li>Connect with other community members</li>
                <li>Update your profile with your interests</li>
                <li>Participate in our ministry activities</li>
              </ul>
              <div style="text-align: center;">
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/dashboard" class="button">Go to Dashboard</a>
              </div>
              <p>We're excited to have you as part of our family and look forward to growing together in faith!</p>
              <p>Blessings,<br>The @Cloud Ministry Team</p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry | Building Community Through Faith</p>
              <p>If you have any questions, please contact us at support@atcloud.org</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: "Welcome to @Cloud Ministry - Account Verified!",
      html,
      text: `Welcome to @Cloud Ministry! Your account has been verified. Visit your dashboard: ${
        process.env.FRONTEND_URL || "http://localhost:5173"
      }/dashboard`,
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
      EmailService.formatDateTimeRange(
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
              <p>If you have any questions, please contact us at support@atcloud.org</p>
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
    const userName = `${userData.firstName} ${userData.lastName}`.trim();
    const adminName = `${changedBy.firstName} ${changedBy.lastName}`.trim();

    // Get role-specific welcome message and permissions
    const getRoleWelcomeContent = (role: string) => {
      switch (role) {
        case "Super Admin":
          return {
            welcome: "Welcome to the highest level of system administration!",
            permissions:
              "You now have full system control, user management, and ministry oversight capabilities.",
            responsibilities:
              "Guide the ministry's digital presence and ensure smooth operations for all members.",
            icon: "👑",
          };
        case "Administrator":
          return {
            welcome: "Welcome to the administrative team!",
            permissions:
              "You can now manage users, oversee events, and handle system configurations.",
            responsibilities:
              "Help maintain the ministry's operations and support other members.",
            icon: "⚡",
          };
        case "Leader":
          return {
            welcome: "Welcome to ministry leadership!",
            permissions:
              "You can now create and manage events, lead ministry initiatives, and guide participants.",
            responsibilities:
              "Shepherd others in their faith journey and organize meaningful ministry activities.",
            icon: "🌟",
          };
        default:
          return {
            welcome: "Welcome to your new role!",
            permissions:
              "You have been granted new capabilities within the ministry.",
            responsibilities:
              "Continue to grow in faith and serve the community.",
            icon: "✨",
          };
      }
    };

    const roleContent = getRoleWelcomeContent(userData.newRole);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Congratulations on Your Promotion - @Cloud Ministry</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .promotion-card { background: white; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745; }
            .role-change { background: linear-gradient(90deg, #e9ecef 0%, #f8f9fa 100%); padding: 20px; border-radius: 8px; margin: 15px 0; }
            .role-item { display: inline-block; padding: 8px 16px; margin: 5px; border-radius: 20px; font-weight: bold; }
            .old-role { background: #6c757d; color: white; }
            .new-role { background: #28a745; color: white; }
            .arrow { font-size: 20px; margin: 0 10px; color: #28a745; }
            .permissions-section { background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 15px 0; }
            .button { display: inline-block; padding: 12px 30px; background: #28a745; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .icon { font-size: 48px; margin-bottom: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="icon">${roleContent.icon}</div>
              <h1>🎉 Congratulations on Your Promotion!</h1>
            </div>
            <div class="content">
              <h2>Dear ${userName},</h2>
              
              <div class="promotion-card">
                <p>We are excited to inform you that you have been promoted within @Cloud Ministry!</p>
                
                <div class="role-change">
                  <div style="text-align: center;">
                    <span class="role-item old-role">${userData.oldRole}</span>
                    <span class="arrow">→</span>
                    <span class="role-item new-role">${userData.newRole}</span>
                  </div>
                </div>

                <p><strong>${roleContent.welcome}</strong></p>
                
                <div class="permissions-section">
                  <h3>🔑 Your New Capabilities:</h3>
                  <p>${roleContent.permissions}</p>
                  
                  <h3>💼 Your Responsibilities:</h3>
                  <p>${roleContent.responsibilities}</p>
                </div>

                <p>This promotion was approved by <strong>${adminName}</strong> (${
      changedBy.role
    }).</p>
              </div>

              <p>We believe in your ability to excel in this new role and make a positive impact on our ministry community. Your dedication and service have not gone unnoticed.</p>

              <div style="text-align: center;">
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/dashboard" class="button">
                  Explore Your New Dashboard
                </a>
              </div>

              <p><em>"For I know the plans I have for you," declares the Lord, "plans to prosper you and not to harm you, to give you hope and a future." - Jeremiah 29:11</em></p>

              <p>Congratulations once again, and may God bless your new journey in ministry leadership!</p>
              
              <p>In His service,<br>The @Cloud Ministry Team</p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry | Building Community Through Faith</p>
              <p>If you have any questions about your new role, please contact us at support@atcloud.org</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `🎉 Congratulations! You've been promoted to ${userData.newRole}`,
      html,
      text: `Congratulations ${userName}! You have been promoted from ${
        userData.oldRole
      } to ${userData.newRole} by ${adminName}. ${
        roleContent.welcome
      } Visit your dashboard to explore your new capabilities: ${
        process.env.FRONTEND_URL || "http://localhost:5173"
      }/dashboard`,
    });
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
    const promotedUserName =
      `${userData.firstName} ${userData.lastName}`.trim();
    const administratorName =
      `${changedBy.firstName} ${changedBy.lastName}`.trim();

    // Get impact level for different promotions
    const getPromotionImpact = (newRole: string) => {
      switch (newRole) {
        case "Super Admin":
          return {
            impact: "High Impact",
            color: "#dc3545",
            description: "Full system administration access granted",
            actions:
              "Review system permissions and monitor administrative activities",
            icon: "🚨",
          };
        case "Administrator":
          return {
            impact: "Medium Impact",
            color: "#fd7e14",
            description:
              "User management and system configuration access granted",
            actions: "Monitor user management activities and system changes",
            icon: "⚠️",
          };
        case "Leader":
          return {
            impact: "Standard",
            color: "#28a745",
            description:
              "Event management and ministry leadership access granted",
            actions: "Support new leader in ministry responsibilities",
            icon: "📈",
          };
        default:
          return {
            impact: "Standard",
            color: "#6f42c1",
            description: "Role permissions updated",
            actions: "Monitor user activity",
            icon: "📝",
          };
      }
    };

    const promotionInfo = getPromotionImpact(userData.newRole);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>User Promotion Alert - @Cloud Ministry Admin</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #495057 0%, #6c757d 100%); color: white; padding: 25px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { margin: 0; font-size: 22px; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
            .admin-alert { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${
              promotionInfo.color
            }; }
            .user-info { background: #e9ecef; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .role-change { text-align: center; margin: 20px 0; }
            .role-item { display: inline-block; padding: 8px 16px; margin: 5px; border-radius: 20px; font-weight: bold; }
            .old-role { background: #6c757d; color: white; }
            .new-role { background: ${promotionInfo.color}; color: white; }
            .arrow { font-size: 18px; margin: 0 10px; color: ${
              promotionInfo.color
            }; }
            .impact-badge { display: inline-block; padding: 6px 12px; border-radius: 15px; font-size: 12px; font-weight: bold; color: white; background: ${
              promotionInfo.color
            }; margin: 10px 0; }
            .action-section { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .button { display: inline-block; padding: 10px 25px; background: #495057; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
            .button.primary { background: ${promotionInfo.color}; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .timestamp { color: #6c757d; font-size: 14px; }
            .icon { font-size: 24px; margin-right: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${promotionInfo.icon} User Promotion Alert</h1>
              <p>Administrative Notification</p>
            </div>
            <div class="content">
              <h2>Hello ${adminName},</h2>
              
              <div class="admin-alert">
                <div class="impact-badge">${promotionInfo.impact}</div>
                
                <h3>User Role Promotion Completed</h3>
                
                <div class="user-info">
                  <strong>👤 Promoted User:</strong> ${promotedUserName}<br>
                  <strong>📧 Email:</strong> ${userData.email}<br>
                  <strong>🔄 Role Change:</strong>
                  <div class="role-change">
                    <span class="role-item old-role">${userData.oldRole}</span>
                    <span class="arrow">→</span>
                    <span class="role-item new-role">${userData.newRole}</span>
                  </div>
                  <strong>👤 Performed By:</strong> ${administratorName} (${
      changedBy.role
    })<br>
                  <strong>⏰ Date:</strong> <span class="timestamp">${new Date().toLocaleString()}</span>
                </div>

                <div class="action-section">
                  <h4>🎯 Impact & Next Steps:</h4>
                  <p><strong>Access Level:</strong> ${
                    promotionInfo.description
                  }</p>
                  <p><strong>Recommended Actions:</strong> ${
                    promotionInfo.actions
                  }</p>
                </div>

                <p>Please monitor the promoted user's activities and provide any necessary guidance for their new role responsibilities.</p>
              </div>

              <div style="text-align: center;">
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/admin/users/${userData.email}" class="button primary">
                  View User Profile
                </a>
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/admin/audit-log" class="button">
                  View Audit Log
                </a>
              </div>

              <p><strong>Note:</strong> This is an automated notification for administrative oversight. If you have any concerns about this promotion, please review the change with the promoting administrator.</p>
              
              <p>Best regards,<br>@Cloud Ministry System</p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry | Administrative Notifications</p>
              <p>This email was sent to all Super Admins and Administrators</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: adminEmail,
      subject: `🚨 Admin Alert: User Promoted to ${userData.newRole} - ${promotedUserName}`,
      html,
      text: `Admin Alert: ${promotedUserName} (${
        userData.email
      }) has been promoted from ${userData.oldRole} to ${
        userData.newRole
      } by ${administratorName}. Impact: ${
        promotionInfo.impact
      }. Please review user management dashboard: ${
        process.env.FRONTEND_URL || "http://localhost:5173"
      }/admin/users`,
    });
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
    const userName = `${userData.firstName || ""} ${
      userData.lastName || ""
    }`.trim();
    const administratorName = `${changedBy.firstName || ""} ${
      changedBy.lastName || ""
    }`.trim();

    // Role-specific guidance and support messages
    const getRoleTransitionGuidance = (newRole: string) => {
      switch (newRole.toLowerCase()) {
        case "participant":
          return {
            message:
              "You remain a valued member of our ministry community with opportunities to grow and serve.",
            responsibilities:
              "Continue participating in events, fellowship activities, and spiritual growth opportunities.",
            encouragement:
              "This transition allows you to focus on personal spiritual development and find new ways to contribute.",
            icon: "🤝",
            color: "#6c757d",
          };
        case "leader":
          return {
            message:
              "You continue to serve in an important leadership capacity within our ministry.",
            responsibilities:
              "Guide and support ministry participants while organizing meaningful activities.",
            encouragement:
              "Your leadership experience remains valuable, and this adjustment helps optimize our ministry structure.",
            icon: "🌟",
            color: "#ffc107",
          };
        case "administrator":
          return {
            message:
              "You maintain significant responsibilities in our ministry administration.",
            responsibilities:
              "Continue managing system operations and supporting our ministry community.",
            encouragement:
              "Your administrative skills are still crucial to our ministry's success.",
            icon: "⚙️",
            color: "#17a2b8",
          };
        default:
          return {
            message: "You remain an important part of our ministry family.",
            responsibilities:
              "Continue growing in faith and finding ways to serve our community.",
            encouragement:
              "Every role in ministry has value, and your contribution matters.",
            icon: "✨",
            color: "#28a745",
          };
      }
    };

    const transitionInfo = getRoleTransitionGuidance(userData.newRole);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Ministry Role Update - @Cloud Ministry</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #6c757d 0%, #495057 100%); color: white; padding: 25px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { margin: 0; font-size: 22px; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
            .transition-card { background: white; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${
              transitionInfo.color
            }; }
            .role-change { text-align: center; margin: 20px 0; background: #e9ecef; padding: 20px; border-radius: 8px; }
            .role-item { display: inline-block; padding: 8px 16px; margin: 5px; border-radius: 20px; font-weight: bold; }
            .old-role { background: #6c757d; color: white; }
            .new-role { background: ${transitionInfo.color}; color: white; }
            .arrow { font-size: 18px; margin: 0 10px; color: #6c757d; }
            .support-section { background: #e8f4fd; border: 1px solid #b3d7ff; padding: 20px; border-radius: 8px; margin: 15px 0; }
            .reason-section { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .encouragement-section { background: #d1ecf1; border: 1px solid #86cfda; padding: 20px; border-radius: 8px; margin: 15px 0; }
            .button { display: inline-block; padding: 12px 30px; background: ${
              transitionInfo.color
            }; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
            .button.support { background: #17a2b8; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .icon { font-size: 32px; margin-bottom: 10px; }
            .timestamp { color: #6c757d; font-size: 14px; }
            .verse { font-style: italic; color: #495057; text-align: center; margin: 20px 0; padding: 15px; background: #f1f3f4; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="icon">${transitionInfo.icon}</div>
              <h1>Ministry Role Update</h1>
              <p>Your Role in @Cloud Ministry</p>
            </div>
            <div class="content">
              <h2>Dear ${userName},</h2>
              
              <div class="transition-card">
                <h3>Your Ministry Role Has Been Updated</h3>
                
                <p>We hope this message finds you well. We want to inform you that your role within @Cloud Ministry has been updated.</p>
                
                <div class="role-change">
                  <strong>Role Transition:</strong><br>
                  <span class="role-item old-role">${userData.oldRole}</span>
                  <span class="arrow">→</span>
                  <span class="role-item new-role">${userData.newRole}</span>
                  <br>
                  <span class="timestamp">Updated on ${new Date().toLocaleDateString()}</span>
                </div>

                ${
                  reason
                    ? `
                <div class="reason-section">
                  <h4>📋 Context for This Change:</h4>
                  <p>${reason}</p>
                </div>`
                    : ""
                }

                <div class="encouragement-section">
                  <h4>💙 Your Continued Value in Ministry</h4>
                  <p>${transitionInfo.message}</p>
                  <p><strong>Your Focus Areas:</strong> ${
                    transitionInfo.responsibilities
                  }</p>
                  <p>${transitionInfo.encouragement}</p>
                </div>

                <div class="support-section">
                  <h4>🤝 Support & Next Steps</h4>
                  <p>We're here to support you through this transition:</p>
                  <ul>
                    <li><strong>Questions or Concerns:</strong> Please don't hesitate to reach out to ${administratorName} or any ministry leader</li>
                    <li><strong>Continued Participation:</strong> All ministry activities and fellowship remain open to you</li>
                    <li><strong>Growth Opportunities:</strong> We encourage you to explore new ways to serve and grow spiritually</li>
                    <li><strong>Feedback:</strong> Your perspective and input continue to be valued and welcomed</li>
                  </ul>
                </div>
              </div>

              <div class="verse">
                "And we know that in all things God works for the good of those who love him, who have been called according to his purpose."<br>
                <strong>- Romans 8:28</strong>
              </div>

              <div style="text-align: center;">
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/dashboard" class="button">
                  Access Your Dashboard
                </a>
                <a href="mailto:${changedBy.email}" class="button support">
                  Contact ${administratorName}
                </a>
              </div>

              <p>Please remember that every role in ministry has purpose and value. This change doesn't diminish your worth or your importance to our community. We're grateful for your continued participation and look forward to your ongoing contributions.</p>
              
              <p>If you have any questions or would like to discuss this change, please feel free to reach out. We're here to support you.</p>

              <p>Grace and peace,<br>@Cloud Ministry Leadership</p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry | Building Faith Community Together</p>
              <p>Role change processed by ${administratorName} (${
      changedBy.role
    })</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: userEmail,
      subject: `Ministry Role Update - Your Position in @Cloud Ministry`,
      html,
      text: `Dear ${userName}, Your role in @Cloud Ministry has been updated from ${
        userData.oldRole
      } to ${userData.newRole}. ${transitionInfo.message} ${
        reason ? `Context: ${reason}` : ""
      } Please contact ${administratorName} (${
        changedBy.email
      }) if you have any questions. Dashboard: ${
        process.env.FRONTEND_URL || "http://localhost:5173"
      }/dashboard`,
    });
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
    const demotedUserName = `${userData.firstName || ""} ${
      userData.lastName || ""
    }`.trim();
    const administratorName = `${changedBy.firstName || ""} ${
      changedBy.lastName || ""
    }`.trim();

    // Demotion impact assessment for administrative oversight
    const getDemotionImpact = (oldRole: string, newRole: string) => {
      const getImpactLevel = (from: string, to: string) => {
        if (from === "Super Admin" && to !== "Super Admin") return "Critical";
        if (from === "Administrator" && to === "Participant") return "High";
        if (from === "Leader" && to === "Participant") return "Medium";
        if (from === "Administrator" && to === "Leader") return "Medium";
        if (from === "Leader" && to === "Administrator") return "Low"; // This would be promotion, but safety check
        return "Standard";
      };

      const impact = getImpactLevel(oldRole, newRole);

      switch (impact) {
        case "Critical":
          return {
            level: impact,
            color: "#dc3545",
            description:
              "Critical system access reduction - requires immediate attention",
            actions:
              "Review all recent system changes, audit user activity, ensure security protocols",
            icon: "🚨",
            priority: "URGENT",
          };
        case "High":
          return {
            level: impact,
            color: "#fd7e14",
            description:
              "Significant privilege reduction from administrative level",
            actions:
              "Monitor user access patterns, review administrative changes, consider transition support",
            icon: "⚠️",
            priority: "HIGH",
          };
        case "Medium":
          return {
            level: impact,
            color: "#ffc107",
            description: "Moderate role adjustment within operational levels",
            actions:
              "Update access permissions, notify relevant teams, provide role transition guidance",
            icon: "📊",
            priority: "MEDIUM",
          };
        default:
          return {
            level: "Standard",
            color: "#6c757d",
            description: "Standard role adjustment",
            actions: "Update user permissions, document change for records",
            icon: "📝",
            priority: "STANDARD",
          };
      }
    };

    const demotionInfo = getDemotionImpact(userData.oldRole, userData.newRole);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>User Demotion Alert - @Cloud Ministry Admin</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #6c757d 0%, #495057 100%); color: white; padding: 25px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { margin: 0; font-size: 22px; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
            .admin-alert { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${
              demotionInfo.color
            }; }
            .user-info { background: #e9ecef; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .role-change { text-align: center; margin: 20px 0; }
            .role-item { display: inline-block; padding: 8px 16px; margin: 5px; border-radius: 20px; font-weight: bold; }
            .old-role { background: #6c757d; color: white; }
            .new-role { background: ${demotionInfo.color}; color: white; }
            .arrow { font-size: 18px; margin: 0 10px; color: ${
              demotionInfo.color
            }; }
            .impact-badge { display: inline-block; padding: 6px 12px; border-radius: 15px; font-size: 12px; font-weight: bold; color: white; background: ${
              demotionInfo.color
            }; margin: 10px 0; }
            .priority-badge { display: inline-block; padding: 4px 8px; border-radius: 10px; font-size: 11px; font-weight: bold; color: white; background: ${
              demotionInfo.color
            }; margin-left: 10px; }
            .reason-section { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .action-section { background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .oversight-section { background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .button { display: inline-block; padding: 10px 25px; background: #495057; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
            .button.primary { background: ${demotionInfo.color}; }
            .button.urgent { background: #dc3545; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .timestamp { color: #6c757d; font-size: 14px; }
            .icon { font-size: 24px; margin-right: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${demotionInfo.icon} User Demotion Alert</h1>
              <p>Administrative Oversight Notification</p>
            </div>
            <div class="content">
              <h2>Hello ${adminName},</h2>
              
              <div class="admin-alert">
                <div class="impact-badge">${demotionInfo.level} Impact</div>
                <span class="priority-badge">${demotionInfo.priority}</span>
                
                <h3>User Role Demotion Processed</h3>
                
                <div class="user-info">
                  <strong>👤 Affected User:</strong> ${demotedUserName}<br>
                  <strong>📧 Email:</strong> ${userData.email}<br>
                  <strong>🔄 Role Change:</strong>
                  <div class="role-change">
                    <span class="role-item old-role">${userData.oldRole}</span>
                    <span class="arrow">→</span>
                    <span class="role-item new-role">${userData.newRole}</span>
                  </div>
                  <strong>👤 Processed By:</strong> ${administratorName} (${
      changedBy.role
    })<br>
                  <strong>⏰ Date:</strong> <span class="timestamp">${new Date().toLocaleString()}</span>
                </div>

                ${
                  reason
                    ? `
                <div class="reason-section">
                  <h4>📋 Reason for Demotion:</h4>
                  <p>${reason}</p>
                </div>`
                    : ""
                }

                <div class="action-section">
                  <h4>⚠️ Impact Assessment & Required Actions:</h4>
                  <p><strong>Impact Level:</strong> ${
                    demotionInfo.description
                  }</p>
                  <p><strong>Required Actions:</strong> ${
                    demotionInfo.actions
                  }</p>
                  ${
                    demotionInfo.level === "Critical"
                      ? "<p><strong>⚡ URGENT:</strong> This change requires immediate administrative review and security verification.</p>"
                      : ""
                  }
                </div>

                <div class="oversight-section">
                  <h4>🔍 Administrative Oversight</h4>
                  <p>Please ensure the following oversight activities are completed:</p>
                  <ul>
                    <li><strong>Access Review:</strong> Verify user permissions have been properly updated</li>
                    <li><strong>Security Check:</strong> Ensure no unauthorized access remains</li>
                    <li><strong>Documentation:</strong> Record this change in the administrative log</li>
                    <li><strong>Follow-up:</strong> Monitor user activity for the next 7 days</li>
                    ${
                      reason
                        ? "<li><strong>Communication:</strong> Ensure user has received appropriate guidance</li>"
                        : ""
                    }
                  </ul>
                </div>

                <p><strong>Administrative Note:</strong> This demotion has been processed and logged for compliance and security purposes. Please review the user's current access level and ensure all security protocols are maintained.</p>
              </div>

              <div style="text-align: center;">
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/admin/users/${userData.email}" class="button primary">
                  Review User Profile
                </a>
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/admin/audit-log" class="button">
                  View Audit Log
                </a>
                ${
                  demotionInfo.level === "Critical"
                    ? `
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/admin/security-review" class="button urgent">
                  Security Review
                </a>`
                    : ""
                }
              </div>

              <p><strong>Security Reminder:</strong> All role demotions are permanently logged for compliance. If this change was unauthorized or you have concerns, please escalate immediately to senior administration.</p>
              
              <p>Best regards,<br>@Cloud Ministry Security System</p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry | Administrative Security Notifications</p>
              <p>Demotion processed by ${administratorName} (${
      changedBy.role
    }) | Impact: ${demotionInfo.level}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: adminEmail,
      subject: `🚨 Admin Alert: User Demoted from ${userData.oldRole} to ${userData.newRole} - ${demotedUserName}`,
      html,
      text: `Admin Alert: ${demotedUserName} (${
        userData.email
      }) has been demoted from ${userData.oldRole} to ${
        userData.newRole
      } by ${administratorName}. Impact: ${demotionInfo.level}. ${
        reason ? `Reason: ${reason}` : ""
      } Please review user management dashboard: ${
        process.env.FRONTEND_URL || "http://localhost:5173"
      }/admin/users`,
    });
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
    const userName = `${userData.firstName || ""} ${
      userData.lastName || ""
    }`.trim();

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Ministry Role Update - @Cloud Ministry</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .role-change { background: #f8f9fa; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Ministry Role Update</h1>
              <p>@Cloud Ministry</p>
            </div>
            <div class="content">
              <h2>Hello ${userName},</h2>
              
              <p>Your ministry role has been updated in our system.</p>
              
              <div class="role-change">
                <h3>Role Change Details</h3>
                <p><strong>Previous Role:</strong> ${
                  userData.oldRoleInAtCloud
                }</p>
                <p><strong>New Role:</strong> ${userData.newRoleInAtCloud}</p>
              </div>

              <p>You can access your updated ministry dashboard and role-specific resources using the button below.</p>

              <div style="text-align: center;">
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/ministry/dashboard" class="button">
                  View Ministry Dashboard
                </a>
              </div>

              <p>If you have any questions about this change, please contact our ministry leadership.</p>
              
              <p>Blessings,<br>@Cloud Ministry Team</p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry | Ministry Role Notification</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: userEmail,
      subject: `Ministry Role Update: ${userData.newRoleInAtCloud}`,
      html,
      text: `Hello ${userName}, Your ministry role has been updated from ${
        userData.oldRoleInAtCloud
      } to ${userData.newRoleInAtCloud}. Access your ministry dashboard: ${
        process.env.FRONTEND_URL || "http://localhost:5173"
      }/ministry/dashboard`,
    });
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
    const userName = `${userData.firstName || ""} ${
      userData.lastName || ""
    }`.trim();
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Admin Alert: Ministry Role Change</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #dc3545 0%, #fd7e14 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .admin-alert { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .user-details { background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .button { display: inline-block; background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚨 Admin Alert</h1>
              <p>Ministry Role Change Notification</p>
            </div>
            <div class="content">
              <h2>Hello ${adminName},</h2>
              <div class="admin-alert">
                <h3>Ministry Role Change Alert</h3>
                <p>A ministry role change has occurred in the system.</p>
              </div>
              <div class="user-details">
                <h4>User Details</h4>
                <p><strong>Name:</strong> ${userName}</p>
                <p><strong>Email:</strong> ${userData.email}</p>
                <p><strong>Previous Role:</strong> ${
                  userData.oldRoleInAtCloud
                }</p>
                <p><strong>New Role:</strong> ${userData.newRoleInAtCloud}</p>
              </div>
              <div style="text-align: center;">
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/admin/users" class="button">
                  Review in Admin Dashboard
                </a>
              </div>
              <p>Best regards,<br>@Cloud Ministry System</p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry | Administrative Notifications</p>
            </div>
          </div>
        </body>
      </html>
    `;
    return this.sendEmail({
      to: adminEmail,
      subject: `🚨 Admin Alert: Ministry Role Change - ${userName}`,
      html,
      text: `Admin Alert: ${userName} (${userData.email}) ministry role changed from ${userData.oldRoleInAtCloud} to ${userData.newRoleInAtCloud}. Please review in admin dashboard.`,
    });
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
    const leaderName = `${newLeaderData.firstName || ""} ${
      newLeaderData.lastName || ""
    }`.trim();

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>New Leader Signup - @Cloud Ministry</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .leader-info { background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .signup-details { background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .button { display: inline-block; background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
            .button:hover { background: #218838; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🌟 New Leader Signup</h1>
              <p>A new leader has joined @Cloud Ministry</p>
            </div>
            <div class="content">
              <p>Hello ${adminName},</p>
              
              <div class="leader-info">
                <h3>🆕 New Leader Registration</h3>
                <p>A new leader has registered for @Cloud Ministry and requires admin review.</p>
              </div>

              <div class="signup-details">
                <h4>Leader Details:</h4>
                <p><strong>Name:</strong> ${leaderName}</p>
                <p><strong>Email:</strong> ${newLeaderData.email}</p>
                <p><strong>Ministry Role:</strong> ${newLeaderData.roleInAtCloud}</p>
                <p><strong>Signup Date:</strong> ${newLeaderData.signupDate}</p>
              </div>

              <p>Please review this new leader's registration and take appropriate action:</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="#{ADMIN_DASHBOARD_URL}/leaders" class="button">Review Leader</a>
                <a href="#{ADMIN_DASHBOARD_URL}/users" class="button" style="background: #6c757d;">Manage Users</a>
              </div>

              <p><em>This is an automated notification. Please review the new leader's information in the admin dashboard.</em></p>
            </div>
            <div class="footer">
              <p>@Cloud Ministry Admin System</p>
              <p>This email was sent to admins for new leader signup notifications.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: adminEmail,
      subject: `🌟 New Leader Signup: ${leaderName} - ${newLeaderData.roleInAtCloud}`,
      html,
      text: `New Leader Signup: ${leaderName} (${newLeaderData.email}) has registered as ${newLeaderData.roleInAtCloud} on ${newLeaderData.signupDate}. Please review in admin dashboard.`,
    });
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
                <p><strong>Date & Time:</strong> ${EmailService.formatDateTimeRange(
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
      }" is ${reminder.label.toLowerCase()} away! ${EmailService.formatDateTimeRange(
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
        EmailService.sendEventReminderEmail(
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

  /**
   * Send @Cloud role assigned notification to admins
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
    const userName = `${userData.firstName} ${userData.lastName}`.trim();

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>@Cloud Co-worker Role Assigned - Admin Notification</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .admin-alert { background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .user-details { background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .button { display: inline-block; background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ @Cloud Co-worker Role Assigned</h1>
              <p>Administrative Oversight Notification</p>
            </div>
            <div class="content">
              <h2>Hello ${adminName},</h2>
              <div class="admin-alert">
                <h3>@Cloud Co-worker Role Assigned</h3>
                <p>A user has been assigned an @Cloud co-worker role.</p>
              </div>
              <div class="user-details">
                <h4>User Details</h4>
                <p><strong>Name:</strong> ${userName}</p>
                <p><strong>Email:</strong> ${userData.email}</p>
                <p><strong>@Cloud Role:</strong> ${userData.roleInAtCloud}</p>
                <p><strong>Status:</strong> Now an @Cloud Co-worker</p>
              </div>
              <div style="text-align: center;">
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/admin/users" class="button">
                  Review in Admin Dashboard
                </a>
              </div>
              <p>Please review the new co-worker assignment and provide any necessary guidance.</p>
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
      subject: `✅ @Cloud Co-worker Role Assigned - ${userName}`,
      html,
      text: `@Cloud Co-worker Role Assigned: ${userName} (${userData.email}) has been assigned the @Cloud role: ${userData.roleInAtCloud}`,
    });
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
    const userName = `${userData.firstName} ${userData.lastName}`.trim();

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>@Cloud Co-worker Role Removed - Admin Notification</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #fd7e14 0%, #ffc107 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .admin-alert { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .user-details { background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .button { display: inline-block; background: #fd7e14; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ @Cloud Co-worker Role Removed</h1>
              <p>Administrative Oversight Notification</p>
            </div>
            <div class="content">
              <h2>Hello ${adminName},</h2>
              <div class="admin-alert">
                <h3>@Cloud Co-worker Role Removal</h3>
                <p>A user has removed their @Cloud co-worker role.</p>
              </div>
              <div class="user-details">
                <h4>User Details</h4>
                <p><strong>Name:</strong> ${userName}</p>
                <p><strong>Email:</strong> ${userData.email}</p>
                <p><strong>Previous @Cloud Role:</strong> ${
                  userData.previousRoleInAtCloud
                }</p>
                <p><strong>Status:</strong> No longer an @Cloud Co-worker</p>
              </div>
              <div style="text-align: center;">
                <a href="${
                  process.env.FRONTEND_URL || "http://localhost:5173"
                }/admin/users" class="button">
                  Review in Admin Dashboard
                </a>
              </div>
              <p>Please review this role removal and ensure appropriate ministry transitions are handled.</p>
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
      subject: `⚠️ @Cloud Co-worker Role Removed - ${userName}`,
      html,
      text: `@Cloud Co-worker Role Removed: ${userName} (${userData.email}) has removed his or her @Cloud co-worker role. 
      Previous role: ${userData.previousRoleInAtCloud}`,
    });
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
    const { event, roleName, actor, user, rejectionToken } = data;
    const subject = `✅ Assigned to ${roleName} - ${event.title}`;
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    // Rejection token creation is deferred to assignment creation flow; placeholder parameter usage.
    const token = encodeURIComponent(
      (rejectionToken || "{{REJECTION_TOKEN}}") as string
    );
    const rejectionLink = `${baseUrl}/assignments/reject?token=${token}`;
    const eventTimeLine =
      event.date && event.time
        ? `${event.date} • ${event.time} (${
            event.timeZone || "event local time"
          })`
        : "Time details not available";
    const text = [
      `You have been assigned to the role "${roleName}" for event "${event.title}" by ${actor.firstName} ${actor.lastName}.`,
      `Event Time: ${eventTimeLine}`,
      "If you accept this assignment, no action is required.",
      "To reject this assignment, visit: ",
      rejectionLink,
    ].join("\n\n");
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;font-size:14px;">
        <p>Hi ${user?.firstName || user?.username || "there"},</p>
        <p>You have been <strong>assigned</strong> to the role <strong>${roleName}</strong> for event <em>${
      event.title
    }</em> by ${actor.firstName} ${actor.lastName}.</p>
        <p><strong>Event Time:</strong><br/>${eventTimeLine}</p>
        <p style="margin-top:16px;">If you <strong>accept</strong> this assignment, no action is required.</p>
        <p>If you need to <strong>reject</strong> it, please provide a brief reason using the button below:</p>
        <p style="text-align:center;margin:24px 0;">
          <a href="${rejectionLink}" style="background:#c62828;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;display:inline-block;">Reject This Assignment</a>
        </p>
        <p style="font-size:12px;color:#666;">This rejection link expires in 14 days. After submission, the assignment will be released.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
        <p style="font-size:12px;color:#888;">If the button doesn’t work, copy and paste this URL into your browser:<br/>
          <span style="word-break:break-all;">${rejectionLink}</span>
        </p>
      </div>
    `;
    return this.sendEmail({ to, subject, text, html });
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
    const { event, fromRoleName, toRoleName, actor } = data;
    const subject = `🔄 Role Updated: ${toRoleName} - ${event.title}`;
    const text = `You were moved from "${fromRoleName}" to "${toRoleName}" in event "${event.title}" by ${actor.firstName} ${actor.lastName}.`;
    const html = `<p>Your role in event <em>${event.title}</em> was <strong>updated</strong> by ${actor.firstName} ${actor.lastName}:<br/>From <strong>${fromRoleName}</strong> → To <strong>${toRoleName}</strong>.</p>`;
    return this.sendEmail({ to, subject, text, html });
  }

  static async sendEventRoleAssignmentRejectedEmail(
    to: string,
    data: {
      event: { id: string; title: string };
      roleName: string;
      rejectedBy: { firstName?: string; lastName?: string };
      assigner: { firstName?: string; lastName?: string };
      noteProvided: boolean;
    }
  ): Promise<boolean> {
    const { event, roleName, rejectedBy, assigner, noteProvided } = data;
    const subject = `❌ Assignment Rejected: ${roleName} - ${event.title}`;
    const rejecterName = `${rejectedBy.firstName || "A user"} ${
      rejectedBy.lastName || ""
    }`.trim();
    const assignerName = `${assigner.firstName || "You"} ${
      assigner.lastName || ""
    }`.trim();
    const noteLine = noteProvided
      ? "A rejection note was provided in the system."
      : "No rejection note was provided.";
    const text = [
      `${rejecterName} rejected the assignment for role "${roleName}" in event "${event.title}".`,
      noteLine,
      "You may reassign this role or contact the user if clarification is needed.",
    ].join("\n\n");
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;font-size:14px;">
        <p><strong>${rejecterName}</strong> has <strong>rejected</strong> the assignment for the role <strong>${roleName}</strong> in event <em>${event.title}</em>.</p>
        <p>${noteLine}</p>
        <p style="margin-top:16px;">You can reassign this role or reach out to the user if more context is needed.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
        <p style="font-size:12px;color:#666;">This is an automated notification regarding role assignment rejection.</p>
      </div>
    `;
    return this.sendEmail({ to, subject, text, html });
  }
}
