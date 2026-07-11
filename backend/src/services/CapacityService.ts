import mongoose from "mongoose";
import { GuestRegistration, Registration } from "../models";

export interface RoleOccupancy {
  users: number;
  guests: number;
  total: number;
  capacity: number | null; // null if capacity cannot be determined
}

export interface RoleOccupancyOptions {
  includeGuests?: boolean;
  /** Capacity from an Event role that the caller has already loaded. */
  capacity?: unknown;
}

export class CapacityService {
  /**
   * Returns current occupancy for the given event role.
   * Counts users and active guests; capacity comes from role data the caller
   * has already loaded.
   */
  static async getRoleOccupancy(
    eventId: string,
    roleId: string,
    options: RoleOccupancyOptions = {},
  ): Promise<RoleOccupancy> {
    const normalizeCount = (value: unknown): number =>
      Number.isFinite(Number(value))
        ? Number(value)
        : Number.parseInt(String(value ?? 0), 10) || 0;
    const eventIdFilter = mongoose.Types.ObjectId.isValid(eventId)
      ? new mongoose.Types.ObjectId(eventId)
      : eventId;
    const includeGuests = options.includeGuests !== false;

    const [users, guests] = await Promise.all([
      (async () => {
        try {
          const rawUserCount = await (
            Registration as unknown as {
              countDocuments: (filter: unknown) => Promise<unknown>;
            }
          ).countDocuments({ eventId: eventIdFilter, roleId });
          return normalizeCount(rawUserCount);
        } catch {
          return 0;
        }
      })(),
      (async () => {
        if (!includeGuests) return 0;

        const guestEventId = mongoose.Types.ObjectId.isValid(eventId)
          ? new mongoose.Types.ObjectId(eventId).toString()
          : eventId;
        try {
          const rawGuestCount = await (
            GuestRegistration as unknown as {
              countActiveRegistrations: (
                eventId: string,
                roleId: string,
              ) => Promise<unknown>;
            }
          ).countActiveRegistrations(guestEventId, roleId);
          return normalizeCount(rawGuestCount);
        } catch {
          return 0;
        }
      })(),
    ]);

    const rawCapacity = options.capacity;
    const parsedCapacity = Number.isFinite(Number(rawCapacity))
      ? Number(rawCapacity)
      : Number.parseInt(String(rawCapacity ?? Number.NaN), 10);
    const capacity = Number.isFinite(parsedCapacity) ? parsedCapacity : null;

    return { users, guests, total: users + guests, capacity };
  }

  /** Returns true when capacity is defined and total >= capacity. */
  static isRoleFull(occ: RoleOccupancy): boolean {
    if (occ.capacity == null) return false;
    return occ.total >= occ.capacity;
  }
}

export default CapacityService;
