/**
 * Phase 1 Migration Demo: EventController Query Replacements
 *
 * This file demonstrates how to replace Event.currentSignups queries
 * with RegistrationQueryService calls.
 */

import { RegistrationQueryService } from "../services/RegistrationQueryService";

/**
 * BEFORE: Using Event.roles.currentSignups
 */
export class EventControllerOld {
  // OLD WAY: Count user's current signups across all roles
  static getUserCurrentSignupsOld(event: any, userId: string): number {
    return event.roles.reduce((count: number, role: any) => {
      return (
        count +
        role.currentSignups.filter(
          (signup: any) => signup.userId.toString() === userId
        ).length
      );
    }, 0);
  }

  // OLD WAY: Check role capacity
  static isRoleFullOld(event: any, roleId: string): boolean {
    const role = event.roles.find((r: any) => r.id === roleId);
    if (!role) return true;

    return role.currentSignups.length >= role.maxParticipants;
  }

  // OLD WAY: Get role participants
  static getRoleParticipantsOld(event: any, roleId: string): any[] {
    const role = event.roles.find((r: any) => r.id === roleId);
    return role ? role.currentSignups : [];
  }

  // OLD WAY: Check if user is registered for role
  static isUserRegisteredForRoleOld(
    event: any,
    userId: string,
    roleId: string
  ): boolean {
    const role = event.roles.find((r: any) => r.id === roleId);
    if (!role) return false;

    return role.currentSignups.some(
      (signup: any) => signup.userId.toString() === userId
    );
  }
}

/**
 * AFTER: Using RegistrationQueryService
 */
export class EventControllerNew {
  // NEW WAY: Count user's current signups (Registration-based)
  static async getUserCurrentSignupsNew(userId: string): Promise<number> {
    const userInfo = await RegistrationQueryService.getUserSignupInfo(userId);
    return userInfo ? userInfo.currentSignups : 0;
  }

  // NEW WAY: Check role capacity (Registration-based)
  static async isRoleFullNew(
    eventId: string,
    roleId: string
  ): Promise<boolean> {
    const availability = await RegistrationQueryService.getRoleAvailability(
      eventId,
      roleId
    );
    return availability ? availability.isFull : true;
  }

  // NEW WAY: Get role participants (Registration-based)
  static async getRoleParticipantsNew(
    eventId: string,
    roleId: string
  ): Promise<any[]> {
    return await RegistrationQueryService.getRoleParticipants(eventId, roleId);
  }

  // NEW WAY: Check if user is registered for role (Registration-based)
  static async isUserRegisteredForRoleNew(
    userId: string,
    eventId: string,
    roleId: string
  ): Promise<boolean> {
    return await RegistrationQueryService.isUserRegisteredForRole(
      userId,
      eventId,
      roleId
    );
  }

  // NEW WAY: Get complete event signup data (Registration-based)
  static async getEventSignupCountsNew(eventId: string) {
    return await RegistrationQueryService.getEventSignupCounts(eventId);
  }
}

/**
 * Migration Helper: Side-by-side comparison functions
 */
export class MigrationComparison {
  /**
   * Test function to compare old vs new approaches
   * This helps verify data consistency during migration
   */
  static async compareUserSignupCounts(
    event: any,
    userId: string
  ): Promise<{
    oldCount: number;
    newCount: number;
    match: boolean;
  }> {
    const oldCount = EventControllerOld.getUserCurrentSignupsOld(event, userId);
    const newCount = await EventControllerNew.getUserCurrentSignupsNew(userId);

    return {
      oldCount,
      newCount,
      match: oldCount === newCount,
    };
  }

  /**
   * Test function to compare role capacity checks
   */
  static async compareRoleCapacity(
    event: any,
    eventId: string,
    roleId: string
  ): Promise<{
    oldIsFull: boolean;
    newIsFull: boolean;
    match: boolean;
  }> {
    const oldIsFull = EventControllerOld.isRoleFullOld(event, roleId);
    const newIsFull = await EventControllerNew.isRoleFullNew(eventId, roleId);

    return {
      oldIsFull,
      newIsFull,
      match: oldIsFull === newIsFull,
    };
  }

  /**
   * Test function to compare participant lists
   */
  static async compareParticipantLists(
    event: any,
    eventId: string,
    roleId: string
  ): Promise<{
    oldCount: number;
    newCount: number;
    match: boolean;
  }> {
    const oldParticipants = EventControllerOld.getRoleParticipantsOld(
      event,
      roleId
    );
    const newParticipants = await EventControllerNew.getRoleParticipantsNew(
      eventId,
      roleId
    );

    return {
      oldCount: oldParticipants.length,
      newCount: newParticipants.length,
      match: oldParticipants.length === newParticipants.length,
    };
  }
}

/**
 * Example usage in actual controller method
 */
export class EventControllerMigrationExample {
  /**
   * Example of how to update a controller method
   * OLD: Direct Event.currentSignups usage
   * NEW: RegistrationQueryService usage
   */
  static async signupForEventNew(req: any, res: any) {
    try {
      const { eventId } = req.params;
      const { roleId } = req.body;
      const userId = req.user._id.toString();

      // OLD WAY (commented out):
      // const event = await Event.findById(eventId);
      // const userCurrentSignups = event.roles.reduce((count, role) => {
      //   return count + role.currentSignups.filter(
      //     signup => signup.userId.toString() === userId
      //   ).length;
      // }, 0);

      // NEW WAY:
      const userInfo = await RegistrationQueryService.getUserSignupInfo(userId);
      if (!userInfo) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!userInfo.canSignupForMore) {
        return res.status(400).json({
          error: "User has reached maximum signup limit",
          currentSignups: userInfo.currentSignups,
          maxAllowed: userInfo.maxAllowedSignups,
        });
      }

      // OLD WAY (commented out):
      // const role = event.roles.find(r => r.id === roleId);
      // if (role.currentSignups.length >= role.maxParticipants) {
      //   return res.status(400).json({ error: 'Role is full' });
      // }

      // NEW WAY:
      const roleAvailability =
        await RegistrationQueryService.getRoleAvailability(eventId, roleId);
      if (!roleAvailability) {
        return res.status(404).json({ error: "Role not found" });
      }

      if (roleAvailability.isFull) {
        return res.status(400).json({
          error: "Role is full",
          capacity: roleAvailability.maxParticipants,
          currentCount: roleAvailability.currentCount,
        });
      }

      // Continue with actual signup logic...
      res.json({
        message: "Migration example - queries replaced successfully",
        userInfo,
        roleAvailability,
      });
    } catch (error) {
      console.error("Error in signup:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

/**
 * Migration Progress Tracker
 */
export const MigrationPhase1Progress = {
  completed: [
    "RegistrationQueryService created",
    "Helper functions implemented",
    "Comparison functions ready",
    "Example replacements documented",
  ],
  inProgress: [
    "EventController query replacements",
    "Testing query consistency",
  ],
  remaining: [
    "Complete all controller updates",
    "Remove Event.currentSignups field",
    "Update frontend API responses",
    "Performance optimization",
  ],
};
