import type { EventData } from "../types/event";

// Return the list of role names that are open to Participant Level (guest-visible) across event types.
export function getParticipantAllowedRoleNames(
  event?: EventData | null
): string[] {
  if (!event) return [];
  if (event.type === "Effective Communication Workshop") {
    const groups = ["A", "B", "C", "D", "E", "F"] as const;
    const allowed: string[] = [];
    groups.forEach((g) => {
      allowed.push(`Group ${g} Leader`);
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
