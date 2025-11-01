import User from "../../models/User";
import Registration from "../../models/Registration";
import GuestRegistration from "../../models/GuestRegistration";
import { CapacityService } from "../../services/CapacityService";
import { lockService } from "../../services/LockService";
import { GUEST_MAX_ROLES_PER_EVENT } from "../../middleware/guestValidation";
import { getMaxRolesPerEvent } from "../../utils/roleRegistrationLimits";

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
  time: string;
  location: string;
  type?: string;
  roles: any[];
  save?: () => Promise<any>;
}

export interface RegistrationResult {
  registrationId: string | null;
  registrationType: "user" | "guest" | null;
  duplicate: boolean;
  capacityBefore: number | null;
  capacityAfter: number | null;
  limitReached: boolean;
  limitReachedFor: "guest" | "user" | null;
  userLimit: number | null;
}

export class RegistrationHelper {
  /**
   * Execute registration with distributed lock
   * EXACT COPY from lines 209-373 (the lock callback body)
   */
  static async executeRegistrationWithLock(
    event: EventData,
    roleId: string,
    targetRole: RoleSnapshot,
    attendee: { name?: string; email?: string; phone?: string }
  ): Promise<RegistrationResult> {
    const lockKey = `public-register:${event._id}:$${(
      attendee.email || ""
    ).toLowerCase()}`;
    let registrationId: string | null = null;
    let registrationType: "user" | "guest" | null = null;
    let duplicate = false;
    let capacityBefore: number | null = null;
    let capacityAfter: number | null = null;
    let limitReached = false;
    let limitReachedFor: "guest" | "user" | null = null;
    let userLimit: number | null = null;

    await lockService.withLock(
      lockKey,
      async () => {
        // Occupancy BEFORE (for capacityBefore + early duplicate idempotency semantics)
        const occBefore = await CapacityService.getRoleOccupancy(
          event._id.toString(),
          roleId
        );
        capacityBefore = occBefore.total;

        // at this point attendee.email is guaranteed (validated earlier)
        const attendeeEmailLc = attendee.email!.toLowerCase();
        const existingUser = await User.findOne({
          email: attendeeEmailLc,
        });

        if (existingUser) {
          // Duplicate user registration check FIRST (idempotent even if capacity is full now)
          const existingReg = await Registration.findOne({
            eventId: event._id,
            userId: existingUser._id,
            roleId,
          });
          if (existingReg) {
            registrationId = existingReg._id.toString();
            registrationType = "user";
            duplicate = true;
            return; // Do NOT capacity-check duplicates
          }
          // NEW POLICY (2025-10-10): Enforce role-based multi-role limit for authenticated users
          const userMaxRoles = getMaxRolesPerEvent(existingUser.role);
          const activeUserRegCount = await Registration.countDocuments({
            eventId: event._id,
            userId: existingUser._id,
            status: "active",
          });
          if (activeUserRegCount >= userMaxRoles) {
            limitReached = true;
            limitReachedFor = "user";
            userLimit = userMaxRoles;
            return; // Exit early - user already at max roles
          }
        } else {
          // Multi-role guest logic: fetch active registrations for this guest & event
          const existingGuestRegs = await GuestRegistration.find(
            {
              eventId: event._id,
              email: attendeeEmailLc,
              status: "active",
            },
            { _id: 1, roleId: 1 }
          ).lean();

          const sameRole = existingGuestRegs.find(
            (g) => (g as { roleId?: string }).roleId === roleId
          );
          if (sameRole) {
            registrationId = (
              sameRole as { _id: { toString(): string } }
            )._id.toString();
            registrationType = "guest";
            duplicate = true; // same-role idempotent
            return; // Exit early: do not create new registration
          }

          // NEW POLICY (2025-10-10): Guests (email-only) limited to 1 role per event
          if (existingGuestRegs.length >= GUEST_MAX_ROLES_PER_EVENT) {
            // Reached global per-guest limit for this event
            limitReached = true;
            limitReachedFor = "guest";
            return; // Exit without creating a new registration
          }
        }

        // Only enforce capacity after duplicate short-circuit so duplicates remain idempotent post-capacity
        if (CapacityService.isRoleFull(occBefore)) {
          throw new Error("Role at full capacity");
        }

        if (existingUser) {
          // Double-check capacity under lock again (race)
          const occBeforeSave = await CapacityService.getRoleOccupancy(
            event._id.toString(),
            roleId
          );
          if (CapacityService.isRoleFull(occBeforeSave)) {
            throw new Error("Role at full capacity");
          }
          const roleSnapshot = targetRole;
          const reg = new Registration({
            eventId: event._id,
            userId: existingUser._id,
            roleId,
            registrationDate: new Date(),
            registeredBy: existingUser._id,
            userSnapshot: {
              username: existingUser.username,
              firstName: existingUser.firstName,
              lastName: existingUser.lastName,
              email: existingUser.email,
              systemAuthorizationLevel: existingUser.role,
              roleInAtCloud: existingUser.roleInAtCloud,
              avatar: existingUser.avatar,
              gender: existingUser.gender,
            },
            eventSnapshot: {
              title: event.title,
              date: event.date,
              time: event.time,
              location: event.location,
              type: event.type,
              roleName: roleSnapshot.name,
              roleDescription: roleSnapshot.description,
            },
          });
          await reg.save();
          registrationId = reg._id.toString();
          registrationType = "user";
        } else {
          // Guest creation path
          const occBeforeGuest = await CapacityService.getRoleOccupancy(
            event._id.toString(),
            roleId
          );
          if (CapacityService.isRoleFull(occBeforeGuest)) {
            throw new Error("Role at full capacity");
          }
          const guest = new GuestRegistration({
            eventId: event._id,
            roleId,
            fullName: attendee.name,
            gender: "male", // default placeholder
            email: attendeeEmailLc,
            phone: attendee.phone,
            eventSnapshot: {
              title: event.title,
              date: new Date(event.date + "T00:00:00Z"),
              location: event.location,
              roleName: targetRole.name,
            },
            migrationStatus: "pending",
          });
          await guest.save();
          registrationId = (
            guest as { _id: { toString(): string } }
          )._id.toString();
          registrationType = "guest";
        }

        if (limitReached) {
          return; // No creation due to limit
        }

        // Recompute occupancy AFTER creation (only when something was created)
        const occAfter = await CapacityService.getRoleOccupancy(
          event._id.toString(),
          roleId
        );
        capacityAfter = occAfter.total;
        if (event.save) {
          await event.save();
        }
      },
      10000
    );

    return {
      registrationId,
      registrationType,
      duplicate,
      capacityBefore,
      capacityAfter,
      limitReached,
      limitReachedFor,
      userLimit,
    };
  }
}
