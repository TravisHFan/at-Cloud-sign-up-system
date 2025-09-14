import type { SystemMessage } from "../../types/notification";

interface BuildOpts {
  id?: string;
  title?: string;
  date: string; // YYYY-MM-DD original local date
  time: string; // HH:mm original local time
  timeZone: string; // IANA zone
  utc?: string; // authoritative UTC instant string
  eventId?: string;
  eventTitle?: string;
  createdAt?: string;
}

export function buildRoleInvitedMessage(opts: BuildOpts): SystemMessage {
  const {
    id = randomId(),
    title = "Role Invited",
    date,
    time,
    timeZone,
    utc,
    eventId = "evt-test",
    eventTitle = "Sample Event",
    createdAt = new Date().toISOString(),
  } = opts;

  const msg: SystemMessage = {
    id,
    title,
    content: `Alice Admin invited you to the role: Greeter for event "${eventTitle}".\n\nEvent Time: ${date} • ${time} (${timeZone})\n\nIf you accept this invitation, no action is required.\nIf you need to decline this invitation, please use the Decline Invitation button below or the link provided in your email.`,
    type: "event_role_change",
    priority: "medium",
    createdAt,
    isRead: false,
    metadata: {
      eventId,
      eventDetailUrl: `/dashboard/event/${eventId}`,
      rejectionLink: `/assignments/reject?token=testtoken-${id}`,
      timing: {
        originalDate: date,
        originalTime: time,
        originalTimeZone: timeZone,
        ...(utc ? { eventDateTimeUtc: utc } : {}),
      },
    },
    creator: {
      id: "admin1",
      firstName: "Alice",
      lastName: "Admin",
      username: "alice.admin",
      roleInAtCloud: "Leader",
      authLevel: "Administrator",
      avatar: "",
      gender: "female",
    },
  };
  return msg;
}

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}
