/**
 * Registration Query Service
 *
 * This service provides helper functions to query Registration data
 * as the single source of truth for event signup information.
 */

import mongoose from "mongoose";
import { createLogger } from "./LoggerService";
import { GuestRegistration, Registration, Event, User } from "../models";
import { CapacityService } from "./CapacityService";

type EventRole = {
  id: string;
  name: string;
  maxParticipants: number;
  description?: string;
};

type EventLean = {
  _id: mongoose.Types.ObjectId;
  title: string;
  date: string;
  endDate?: string;
  time: string;
  endTime?: string;
  location?: string;
  roles: EventRole[];
  type?: string;
  timeZone?: string;
  hostedBy?: string;
  organizerDetails?: Array<Record<string, unknown>>;
  createdBy: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
  status?: string;
  workshopGroupTopics?: Record<string, unknown>;
};

type RoleCountRow = {
  _id: string;
  count: number;
};

export interface RoleAvailability {
  roleId: string;
  roleName: string;
  maxParticipants: number;
  currentCount: number;
  availableSpots: number;
  isFull: boolean;
  waitlistCount: number;
}

export interface EventSignupCounts {
  eventId: string;
  totalSignups: number;
  totalSlots: number;
  roles: RoleAvailability[];
}

export interface UserSignupInfo {
  userId: string;
  currentSignups: number;
  maxAllowedSignups: number;
  canSignupForMore: boolean;
  activeRegistrations: Array<{
    eventId: string;
    roleId: string;
    eventTitle: string;
    roleName: string;
  }>;
}

/**
 * Registration Query Service
 * Provides optimized queries using Registration collection as single source of truth
 */
export class RegistrationQueryService {
  private static logger = createLogger("RegistrationQueryService");
  /**
   * Get role availability for a specific role in an event

   */
  static async getRoleAvailability(
    eventId: string,
    roleId: string
  ): Promise<RoleAvailability | null> {
    try {
      // Get event role info for capacity
      const event = (await Event.findById(eventId).lean()) as EventLean | null;
      if (!event) return null;

      const role = event.roles.find((r: EventRole) => r.id === roleId);
      if (!role) return null;

      // Centralized occupancy: users + active guests via CapacityService
      const occ = await CapacityService.getRoleOccupancy(eventId, roleId, {
        capacity: role.maxParticipants,
      });
      const combinedCount = occ.total;

      // Since we removed status complexity, waitlist is always 0
      const waitlistCount = 0;

      const availableSpots = Math.max(0, role.maxParticipants - combinedCount);

      return {
        roleId,
        roleName: role.name,
        maxParticipants: role.maxParticipants,
        currentCount: combinedCount,
        availableSpots,
        isFull: combinedCount >= role.maxParticipants,
        waitlistCount,
      };
    } catch (error) {
      this.logger.error("Error getting role availability", error as Error);
      return null;
    }
  }

  /**
   * Get signup counts for all roles in an event

   */
  static async getEventSignupCounts(
    eventId: string,
    loadedEvent?: Pick<EventLean, "roles">,
  ): Promise<EventSignupCounts | null> {
    try {
      const eventIdFilter = mongoose.Types.ObjectId.isValid(eventId)
        ? new mongoose.Types.ObjectId(eventId)
        : eventId;
      const eventPromise = loadedEvent
        ? Promise.resolve(loadedEvent)
        : (Event.findById(eventId)
            .select("roles")
            .lean() as Promise<Pick<EventLean, "roles"> | null>);

      const [event, userCounts, guestCounts] = await Promise.all([
        eventPromise,
        Registration.aggregate<RoleCountRow>([
          { $match: { eventId: eventIdFilter } },
          { $group: { _id: "$roleId", count: { $sum: 1 } } },
        ]),
        GuestRegistration.aggregate<RoleCountRow>([
          { $match: { eventId: eventIdFilter, status: "active" } },
          { $group: { _id: "$roleId", count: { $sum: 1 } } },
        ]),
      ]);

      if (!event) return null;

      const countsByRole = new Map<string, number>();
      for (const row of [...userCounts, ...guestCounts]) {
        countsByRole.set(
          row._id,
          (countsByRole.get(row._id) ?? 0) + Number(row.count || 0),
        );
      }

      const roles: RoleAvailability[] = (event.roles || []).map(
        (role: EventRole) => {
          const currentCount = countsByRole.get(role.id) ?? 0;
          return {
            roleId: role.id,
            roleName: role.name,
            maxParticipants: role.maxParticipants,
            currentCount,
            availableSpots: Math.max(
              0,
              role.maxParticipants - currentCount,
            ),
            isFull: currentCount >= role.maxParticipants,
            waitlistCount: 0,
          };
        },
      );

      const totalSignups = roles.reduce(
        (sum, role) => sum + role.currentCount,
        0
      );
      const totalSlots = roles.reduce(
        (sum, role) => sum + role.maxParticipants,
        0
      );

      return {
        eventId,
        totalSignups,
        totalSlots,
        roles,
      };
    } catch (error) {
      this.logger.error("Error getting event signup counts", error as Error);
      return null;
    }
  }

  /**
   * Get user's current signup count and info

   */
  static async getUserSignupInfo(
    userId: string
  ): Promise<UserSignupInfo | null> {
    try {
      // Get user's registrations with event details (no status filtering needed)
      const registrations = await Registration.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
          },
        },
        {
          $project: {
            eventId: 1,
            roleId: 1,
            "eventSnapshot.title": 1,
            "eventSnapshot.roleName": 1,
          },
        },
      ]);

      // Get user role to determine max allowed signups
      const userDoc = (await User.findById(userId).lean()) as {
        role?: string;
        systemAuthorizationLevel?: string;
      } | null;
      if (!userDoc) return null;

      // Define role limits (matching existing business logic)
      const roleLimits = {
        Participant: 1,
        Leader: 2,
        Administrator: 3,
        "Super Admin": 3,
      };

      const roleKey = (userDoc.role ||
        userDoc.systemAuthorizationLevel ||
        "Participant") as keyof typeof roleLimits;
      const maxAllowedSignups = roleLimits[roleKey] || 1;
      const currentSignups = registrations.length;

      return {
        userId,
        currentSignups,
        maxAllowedSignups,
        canSignupForMore: currentSignups < maxAllowedSignups,
        activeRegistrations: registrations.map((reg) => ({
          eventId: reg.eventId.toString(),
          roleId: reg.roleId,
          eventTitle: reg.eventSnapshot.title,
          roleName: reg.eventSnapshot.roleName,
        })),
      };
    } catch (error) {
      this.logger.error("Error getting user signup info", error as Error);
      return null;
    }
  }

  /**
   * Get participants for a specific role (with user details)

   */
  static async getRoleParticipants(eventId: string, roleId: string) {
    try {
      const participants = await Registration.aggregate([
        {
          $match: {
            eventId: new mongoose.Types.ObjectId(eventId),
            roleId,
          },
        },
        {
          $project: {
            userId: 1,
            "userSnapshot.username": 1,
            "userSnapshot.firstName": 1,
            "userSnapshot.lastName": 1,
            "userSnapshot.avatar": 1,
            "userSnapshot.gender": 1,
            registrationDate: 1,
            notes: 1,
          },
        },
        {
          $sort: { registrationDate: 1 }, // First registered, first listed
        },
      ]);

      return participants.map((p) => ({
        userId: p.userId.toString(),
        username: p.userSnapshot.username,
        firstName: p.userSnapshot.firstName,
        lastName: p.userSnapshot.lastName,
        avatar: p.userSnapshot.avatar,
        gender: p.userSnapshot.gender,
        registrationDate: p.registrationDate,
        notes: p.notes,
      }));
    } catch (error) {
      this.logger.error("Error getting role participants", error as Error);
      return [];
    }
  }

  /**
   * Check if user is registered for a specific role

   */
  static async isUserRegisteredForRole(
    userId: string,
    eventId: string,
    roleId: string
  ): Promise<boolean> {
    try {
      const registration = await Registration.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        eventId: new mongoose.Types.ObjectId(eventId),
        roleId,
      }).lean();

      return !!registration;
    } catch (error) {
      this.logger.error("Error checking user registration", error as Error);
      return false;
    }
  }

  /**
   * Get user's current role in an event (if any)

   */
  static async getUserRoleInEvent(userId: string, eventId: string) {
    try {
      const registration = (await Registration.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        eventId: new mongoose.Types.ObjectId(eventId),
      }).lean()) as null | {
        roleId: string;
        eventSnapshot: { roleName: string };
        registrationDate: Date;
      };

      if (!registration) return null;

      return {
        roleId: registration.roleId,
        roleName: registration.eventSnapshot.roleName,
        registrationDate: registration.registrationDate,
      };
    } catch (error) {
      this.logger.error("Error getting user role in event", error as Error);
      return null;
    }
  }
}
