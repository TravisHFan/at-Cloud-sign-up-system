/**
 * EventSnapshotBuilder
 *
 * Centralizes creation of event snapshot payloads used in Registration and GuestRegistration
 * to ensure consistency and reduce duplication.
 */

export class EventSnapshotBuilder {
  /**
   * Build the eventSnapshot object for a user Registration document.
   * Schema contract (Registration.eventSnapshot):
   * - title: string
   * - date: string (YYYY-MM-DD)
   * - time: string (HH:MM)
   * - location: string
   * - type: string
   * - roleName: string
   * - roleDescription: string
   */
  static buildRegistrationSnapshot(event: any, role: any) {
    return {
      title: String(event.title || ""),
      date: String(event.date || ""),
      time: String(event.time || ""),
      location: String(event.location || ""),
      type: String(event.type || ""),
      roleName: String(role?.name || ""),
      roleDescription: String(role?.description || ""),
    };
  }

  /**
   * Build the eventSnapshot object for a GuestRegistration document.
   * Schema contract (GuestRegistration.eventSnapshot):
   * - title: string
   * - date: Date
   * - location: string
   * - roleName: string
   */
  static buildGuestSnapshot(event: any, role: any) {
    const dateValue = event?.date;
    const date =
      dateValue instanceof Date ? dateValue : new Date(String(dateValue || ""));
    return {
      title: String(event.title || ""),
      date,
      location: String(event.location || ""),
      roleName: String(role?.name || ""),
    };
  }
}

export default EventSnapshotBuilder;
