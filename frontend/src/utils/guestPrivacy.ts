// Centralized utilities for guest privacy and visibility rules

export type WorkshopGroup = "A" | "B" | "C" | "D" | "E" | "F";

/** Extracts group letter (A-F) from role name like "Group A Leader" or "Group B Participants". */
export function extractGroupLetterFromRoleName(
  roleName: string
): WorkshopGroup | undefined {
  const match = roleName.match(/^Group ([A-F]) (Leader|Participants)$/);
  return (match?.[1] as WorkshopGroup) || undefined;
}

/**
 * Determines if guest contact info (email/phone) should be visible in a slot.
 * Rules:
 * - For "Effective Communication Workshop":
 *   Admins and organizers always see. Additionally, viewers in the same group (A-F) can see.
 * - For other event types: Only admins and organizers can see.
 */
export function canSeeGuestContactInSlot(params: {
  eventType?: string;
  roleName: string;
  viewerGroupLetters?: WorkshopGroup[];
  isAdminViewer: boolean;
  isOrganizerViewer: boolean;
}): boolean {
  const {
    eventType,
    roleName,
    viewerGroupLetters,
    isAdminViewer,
    isOrganizerViewer,
  } = params;
  if (isAdminViewer || isOrganizerViewer) return true;

  if (eventType === "Effective Communication Workshop") {
    const slotGroup = extractGroupLetterFromRoleName(roleName);
    return !!(
      slotGroup &&
      viewerGroupLetters &&
      viewerGroupLetters.includes(slotGroup)
    );
  }

  return false;
}
