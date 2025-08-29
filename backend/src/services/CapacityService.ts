import mongoose from "mongoose";
import { GuestRegistration, Registration, Event, IEventRole } from "../models";

export interface RoleOccupancy {
  users: number;
  guests: number;
  total: number;
  capacity: number | null; // null if capacity cannot be determined
}

export class CapacityService {
  /**
   * Returns current occupancy for the given event role.
   * Counts users and active guests; derives capacity from role.maxParticipants (fallback: role.capacity).
   */
  static async getRoleOccupancy(
    eventId: string,
    roleId: string,
    options?: { includeGuests?: boolean }
  ): Promise<RoleOccupancy> {
    let users = 0;
    let guests = 0;
    let capacity: number | null = null;

    try {
      const eventIdFilter = mongoose.Types.ObjectId.isValid(eventId)
        ? new mongoose.Types.ObjectId(eventId)
        : eventId; // allow string IDs in tests/mocks
      // Prefer the typed countDocuments; fall back defensively if tests stub a custom method
      const rawUserCount = await (
        Registration as unknown as {
          countDocuments: (filter: unknown) => Promise<unknown>;
        }
      ).countDocuments({
        eventId: eventIdFilter,
        roleId,
      });
      users = Number.isFinite(Number(rawUserCount))
        ? Number(rawUserCount)
        : Number.parseInt(String(rawUserCount ?? 0), 10) || 0;
    } catch (_) {
      users = 0;
    }
    const includeGuests = options?.includeGuests !== false; // default true
    if (includeGuests) {
      try {
        const guestEventId = mongoose.Types.ObjectId.isValid(eventId)
          ? new mongoose.Types.ObjectId(eventId).toString()
          : eventId;
        const rawGuestCount = await (
          GuestRegistration as unknown as {
            countActiveRegistrations: (
              eventId: string,
              roleId: string
            ) => Promise<unknown>;
          }
        ).countActiveRegistrations(guestEventId, roleId);
        guests = Number.isFinite(Number(rawGuestCount))
          ? Number(rawGuestCount)
          : Number.parseInt(String(rawGuestCount ?? 0), 10) || 0;
      } catch (_) {
        guests = 0;
      }
    } else {
      guests = 0;
    }

    try {
      const evt = await Event.findById(eventId);
      const role: IEventRole | undefined = (evt?.roles || []).find(
        (r: IEventRole) => r.id === roleId
      );
      const raw = role
        ? (role as unknown as { maxParticipants?: unknown }).maxParticipants ??
          (role as unknown as { capacity?: unknown }).capacity
        : undefined;
      capacity = Number.isFinite(Number(raw))
        ? Number(raw)
        : Number.parseInt(String(raw ?? NaN), 10);
      if (!Number.isFinite(capacity as number)) capacity = null;
    } catch (_) {
      capacity = null;
    }

    return { users, guests, total: Number(users) + Number(guests), capacity };
  }

  /** Returns true when capacity is defined and total >= capacity. */
  static isRoleFull(occ: RoleOccupancy): boolean {
    if (occ.capacity == null) return false;
    return occ.total >= occ.capacity;
  }
}

export default CapacityService;
