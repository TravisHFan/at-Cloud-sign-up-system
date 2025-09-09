import type { EventData } from "../types/event";

// Return the list of role names that are open to Participant Level (guest-visible) across event types.
export function getParticipantAllowedRoleNames(
  event?: EventData | null
): string[] {
  if (!event) return [];
  // Webinar: open breakout lead roles to Participant-level (and therefore guests)
  if (event.type === "Webinar") {
    return [
      "Attendee",
      "Breakout Room Leads for E Circle",
      "Breakout Room Leads for M Circle",
      "Breakout Room Leads for B Circle",
      "Breakout Room Leads for A Circle",
    ];
  }
  if (event.type === "Effective Communication Workshop") {
    const groups = ["A", "B", "C", "D", "E", "F"] as const;
    const allowed: string[] = [];
    groups.forEach((g) => {
      // Guests should only see/select participant roles for workshop groups
      allowed.push(`Group ${g} Participants`);
    });
    return allowed;
  }
  return [
    "Prepared Speaker (on-site)",
    "Prepared Speaker (Zoom)",
    "Common Participant (on-site)",
    "Common Participant (Zoom)",
  ];
}

export default getParticipantAllowedRoleNames;
