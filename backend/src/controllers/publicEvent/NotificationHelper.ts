import { hashEmail } from "../../utils/privacy";
import { EmailService } from "../../services/infrastructure/EmailServiceFacade";
import { buildRegistrationICS } from "../../services/ICSBuilder";
import buildPublicRegistrationConfirmationEmail from "../../services/emailTemplates/publicRegistrationConfirmation";
import AuditLog from "../../models/AuditLog";
import { CorrelatedLogger } from "../../services/CorrelatedLogger";

interface RoleSnapshot {
  id: string;
  name: string;
  description?: string;
  openToPublic?: boolean;
  capacity?: number;
}

interface EventData {
  _id: any;
  title: string;
  date: string;
  endDate?: string | undefined;
  time: string;
  endTime?: string | undefined;
  location: string;
  purpose?: string | undefined;
  timeZone?: string | undefined;
  isHybrid?: boolean;
  zoomLink?: string;
  meetingId?: string;
  passcode?: string;
  format?: string | undefined;
  roles: any[];
}

export class NotificationHelper {
  /**
   * Send confirmation email with ICS attachment (fire-and-forget)
   * EXACT COPY from lines 409-472
   */
  static async sendConfirmationEmail(
    event: EventData,
    roleId: string,
    attendee: { email?: string; name?: string },
    duplicate: boolean
  ): Promise<void> {
    try {
      const roleSnapshot: RoleSnapshot | undefined = (
        event.roles as unknown as RoleSnapshot[]
      ).find((r) => r.id === roleId);
      const ics = buildRegistrationICS({
        event: {
          _id: event._id,
          title: event.title,
          date: event.date,
          endDate: event.endDate as any,
          time: event.time,
          endTime: event.endTime as any,
          location: event.location,
          purpose: event.purpose,
          timeZone: event.timeZone,
        },
        role: roleSnapshot
          ? {
              name: roleSnapshot.name,
              description: roleSnapshot.description || "",
            }
          : null,
        attendeeEmail: attendee.email,
      });
      const { subject, html, text } = buildPublicRegistrationConfirmationEmail({
        event: {
          title: event.title,
          date: event.date,
          endDate: event.endDate as any,
          time: event.time,
          endTime: event.endTime as any,
          location: event.location,
          purpose: event.purpose || "",
          timeZone: event.timeZone || "",
          isHybrid: event.isHybrid,
          zoomLink: event.zoomLink,
          meetingId: event.meetingId,
          passcode: event.passcode,
          // include format for hybrid inference when isHybrid flag not set
          format: event.format as any,
        },
        roleName: roleSnapshot?.name,
        duplicate,
      });
      EmailService.sendEmail({
        to: attendee.email!,
        subject,
        html,
        text,
        attachments: [
          {
            filename: ics.filename,
            content: ics.content,
            contentType: "text/calendar; charset=utf-8; method=PUBLISH",
          },
        ],
      }).catch(() => undefined);
    } catch {
      /* ignore email build failures */
    }
  }

  /**
   * Create audit log and application log
   * EXACT COPY from lines 474-510
   */
  static async createAuditLog(
    event: EventData,
    roleId: string,
    attendee: { email?: string },
    registrationType: "user" | "guest" | null,
    duplicate: boolean,
    capacityBefore: number | null,
    capacityAfter: number | null,
    requestId: string | undefined,
    ipCidr: string,
    log: CorrelatedLogger,
    user?: { _id: unknown; role: string; email: string } | null
  ): Promise<void> {
    // Persist audit log with actor info if user is authenticated
    try {
      const auditData: Record<string, unknown> = {
        action: "PublicRegistrationCreated",
        eventId: event._id,
        emailHash: attendee.email ? hashEmail(attendee.email) : null,
        metadata: {
          // Include eventId within metadata so tests querying metadata.eventId can locate this log
          eventId: event._id.toString(),
          roleId,
          registrationType,
          duplicate,
          capacityBefore,
          capacityAfter,
          requestId,
          ipCidr,
        },
      };

      // Add actor information if user is authenticated
      if (user) {
        auditData.actor = {
          id: user._id,
          role: user.role,
          email: user.email,
        };
      }

      await AuditLog.create(auditData);
    } catch (auditErr) {
      log.warn(
        "Failed to persist audit log for public registration",
        undefined,
        {
          error: (auditErr as Error).message,
        }
      );
    }

    // Also structured application log for observability
    log.info("Public registration created", undefined, {
      eventId: event._id.toString(),
      roleId,
      registrationType,
      duplicate,
      capacityBefore,
      capacityAfter,
      emailHash: hashEmail(attendee.email!),
      requestId,
      ipCidr,
    });
  }
}
