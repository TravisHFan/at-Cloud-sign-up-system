// Centralized utilities for guest privacy and visibility rules

/**
 * Determines if guest contact info (email/phone) should be visible in a slot.
 * Rules:
 * - Admins and organizers always see contact information
 * - All other registered users can see contact information (simplified from old group-based logic)
 */
export function canSeeGuestContactInSlot(params: {
  isAdminViewer: boolean;
  isOrganizerViewer: boolean;
}): boolean {
  const { isAdminViewer, isOrganizerViewer } = params;

  // Admins and organizers always see, but we now show contacts to everyone
  // (backend handles the actual privacy logic)
  return isAdminViewer || isOrganizerViewer || true;
}
