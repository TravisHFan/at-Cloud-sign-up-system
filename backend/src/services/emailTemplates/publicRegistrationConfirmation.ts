import { IEvent } from "../../models/Event";

export interface PublicRegistrationEmailParams {
  event: Pick<
    IEvent,
    | "title"
    | "date"
    | "endDate"
    | "time"
    | "endTime"
    | "location"
    | "purpose"
    | "timeZone"
    | "isHybrid"
    | "zoomLink"
    | "meetingId"
    | "passcode"
    | "format"
  >;
  roleName?: string | null;
  duplicate?: boolean;
}

export interface BuiltPublicRegistrationEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Build HTML + text template for public registration confirmation.
 * Keeps formatting deterministic and dependency-free.
 */
export function buildPublicRegistrationConfirmationEmail(
  params: PublicRegistrationEmailParams
): BuiltPublicRegistrationEmail {
  const { event, roleName, duplicate } = params;
  const dateRange = formatDateTimeRange(event);
  const subject = duplicate
    ? `Already Registered: ${event.title}`
    : `Registration Confirmed: ${event.title}`;

  const roleLine = roleName
    ? `<p style="margin:4px 0 12px 0;font-size:14px">Role: <strong>${escapeHtml(
        roleName
      )}</strong></p>`
    : "";

  const duplicateNotice = duplicate
    ? `<p style="background:#fff4e5;padding:8px 10px;border-left:4px solid #ffa726;margin:16px 0 12px 0;font-size:13px">It looks like you were already registered. We've re-sent the calendar details below.</p>`
    : "";

  const purpose = event.purpose
    ? `<p style="white-space:pre-line;margin:12px 0 18px 0;font-size:14px;line-height:1.4">${escapeHtml(
        event.purpose
      )}</p>`
    : "";

  const location = event.location
    ? `<p style="margin:4px 0 12px 0;font-size:14px">Location: <strong>${escapeHtml(
        event.location
      )}</strong></p>`
    : "";

  const timeZoneNote = event.timeZone
    ? `<p style="margin:0 0 16px 0;font-size:12px;color:#555">Times shown in ${escapeHtml(
        event.timeZone
      )}.</p>`
    : "";

  const calendarHint = `<p style="margin:20px 0 0 0;font-size:12px;color:#555">Add this event to your calendar by opening the attached file (ICS). If the time zone looks off, confirm your calendar settings.</p>`;

  // Hybrid / virtual meeting details (only if flagged hybrid and details present)
  const zoomLink =
    (event as any).zoomLink && String((event as any).zoomLink).trim();
  const meetingId =
    (event as any).meetingId && String((event as any).meetingId).trim();
  const passcode =
    (event as any).passcode && String((event as any).passcode).trim();
  const formatRaw = (event as any).format || (event as any).eventFormat || "";
  const inferredHybrid = /hybrid participation/i.test(String(formatRaw));
  const isHybrid = !!((event as any).isHybrid || inferredHybrid);
  const isOnlineOnly = /^(online)$/i.test(String(formatRaw).trim());
  // Show virtual section if the format is Online OR hybrid OR any virtual detail fields exist (defensive)
  const hasAnyVirtualDetail = !!(zoomLink || meetingId || passcode);
  const shouldShowVirtual =
    (isHybrid || isOnlineOnly || hasAnyVirtualDetail) && hasAnyVirtualDetail;
  const virtualHtml = shouldShowVirtual
    ? `
    <div style="margin:16px 0 0 0">
      <h2 style="margin:0 0 8px 0;font-size:16px">Join Online</h2>
      ${
        zoomLink
          ? `<p style="margin:4px 0 12px 0;font-size:14px">Zoom Link: <a href="${escapeHtml(
              zoomLink
            )}">${escapeHtml(zoomLink)}</a></p>`
          : ""
      }
      ${
        meetingId || passcode
          ? `<p style="margin:4px 0 12px 0;font-size:14px">${
              meetingId
                ? `<span>Meeting ID: <strong>${escapeHtml(
                    meetingId
                  )}</strong></span>`
                : ""
            }${meetingId && passcode ? " &nbsp; | &nbsp; " : ""}${
              passcode
                ? `Passcode: <strong>${escapeHtml(passcode)}</strong>`
                : ""
            }</p>`
          : ""
      }
      <p style="margin:0 0 0 0;font-size:12px;color:#555">Online access details for this event. Keep this information private.</p>
    </div>`
    : "";

  const html = `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:0;padding:16px;background:#f8fafc;color:#111">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;padding:24px;border:1px solid #e2e8f0;border-radius:8px">
    <h1 style="margin:0 0 8px 0;font-size:20px;line-height:1.2">${escapeHtml(
      event.title
    )}</h1>
    ${
      purpose
        ? // Re-use computed purpose HTML but tweak margins for new placement
          purpose.replace(/margin:12px 0 18px 0/, "margin:0 0 14px 0")
        : ""
    }
    <p style="margin:0 0 12px 0;font-size:14px;color:#444">${dateRange}</p>
    ${location}
    ${roleLine}
    ${duplicateNotice}
    <p style="margin:0 0 16px 0;font-size:14px">${
      duplicate ? "You are already registered." : "You are registered."
    } A calendar invite is attached for your convenience.</p>
    ${timeZoneNote}
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
  ${virtualHtml}
  ${calendarHint}
    <p style="margin:24px 0 0 0;font-size:11px;color:#888">@Cloud Event Sign-up System • This is an automated message.</p>
  </div>
</body></html>`;

  const textLines: string[] = [];
  textLines.push(event.title);
  if (event.purpose) {
    textLines.push("--- Description ---");
    textLines.push(event.purpose);
  }
  textLines.push(dateRange);
  if (event.location) textLines.push(`Location: ${event.location}`);
  if (shouldShowVirtual) {
    textLines.push("--- Online Access ---");
    if (zoomLink) textLines.push(`Zoom Link: ${zoomLink}`);
    if (meetingId) textLines.push(`Meeting ID: ${meetingId}`);
    if (passcode) textLines.push(`Passcode: ${passcode}`);
  }
  if (roleName) textLines.push(`Role: ${roleName}`);
  textLines.push(
    duplicate ? "You are already registered." : "You are registered."
  );
  if (event.timeZone) textLines.push(`Time Zone: ${event.timeZone}`);
  textLines.push(
    "Add to your calendar via the attached ICS file (open or import)."
  );
  const text = textLines.join("\n\n");

  return { subject, html, text };
}

function formatDateTimeRange(
  event: PublicRegistrationEmailParams["event"]
): string {
  const { date, endDate, time, endTime, timeZone } = event;
  const start = `${date} ${time}`; // Preserve raw for deterministic email
  const end = `${endDate || date} ${endTime}`;
  if (date === endDate) {
    return `${date} ${time}–${endTime}${timeZone ? " (" + timeZone + ")" : ""}`;
  }
  return `${start} → ${end}${timeZone ? " (" + timeZone + ")" : ""}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default buildPublicRegistrationConfirmationEmail;
