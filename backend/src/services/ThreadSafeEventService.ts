/**
 * Thread-Safe Event Operations Service
 *
 * Provides thread-safe event operations using application-level locking
 * to prevent race conditions in multi-collection updates.
 */

import mongoose from "mongoose";
import { Event, Registration, IEvent, IEventParticipant } from "../models";
import { lockService } from "./LockService";

export interface IEventOperationResult {
  success: boolean;
  event?: IEvent;
  message: string;
  data?: any;
}

export interface ISignupData {
  userId: mongoose.Types.ObjectId;
  roleId: string;
  userData: Partial<IEventParticipant>;
  registrationData: {
    notes?: string;
    specialRequirements?: string;
    registeredBy: mongoose.Types.ObjectId;
    userSnapshot: any;
    eventSnapshot: any;
  };
}

export interface ICancelData {
  userId: mongoose.Types.ObjectId;
  roleId: string;
}

export class ThreadSafeEventService {
  /**
   * Thread-safe event signup operation
   * Prevents race conditions when multiple users signup for the same role
   */
  static async signupForEvent(
    eventId: string,
    signupData: ISignupData
  ): Promise<IEventOperationResult> {
    const lockKey = `signup:${eventId}:${signupData.roleId}`;

    return await lockService.withLock(lockKey, async () => {
      return await this.executeSignup(eventId, signupData);
    });
  }

  /**
   * Thread-safe event cancellation operation
   * Ensures consistent removal from both Event and Registration collections
   */
  static async cancelSignup(
    eventId: string,
    cancelData: ICancelData
  ): Promise<IEventOperationResult> {
    const lockKey = `cancel:${eventId}:${cancelData.roleId}:${cancelData.userId}`;

    return await lockService.withLock(lockKey, async () => {
      return await this.executeCancel(eventId, cancelData);
    });
  }

  /**
   * Thread-safe user removal (admin operation)
   * Ensures consistent removal with proper audit trail
   */
  static async removeUserFromRole(
    eventId: string,
    targetUserId: mongoose.Types.ObjectId,
    roleId: string,
    removedBy: mongoose.Types.ObjectId
  ): Promise<IEventOperationResult> {
    const lockKey = `remove:${eventId}:${roleId}:${targetUserId}`;

    return await lockService.withLock(lockKey, async () => {
      return await this.executeRemoval(
        eventId,
        targetUserId,
        roleId,
        removedBy
      );
    });
  }

  /**
   * Thread-safe user move between roles (admin operation)
   * Ensures atomic transfer between roles
   */
  static async moveUserBetweenRoles(
    eventId: string,
    userId: mongoose.Types.ObjectId,
    fromRoleId: string,
    toRoleId: string,
    movedBy: mongoose.Types.ObjectId
  ): Promise<IEventOperationResult> {
    const lockKey = `move:${eventId}:${fromRoleId}:${toRoleId}:${userId}`;

    return await lockService.withLock(lockKey, async () => {
      return await this.executeMove(
        eventId,
        userId,
        fromRoleId,
        toRoleId,
        movedBy
      );
    });
  }

  // ====================
  // PRIVATE IMPLEMENTATIONS
  // ====================

  private static async executeSignup(
    eventId: string,
    { userId, roleId, userData, registrationData }: ISignupData
  ): Promise<IEventOperationResult> {
    try {
      // 1. Find and validate event
      const event = await Event.findById(eventId);
      if (!event) {
        return {
          success: false,
          message: "Event not found",
        };
      }

      // 2. Find and validate role
      const role = event.roles.find((r) => r.id === roleId);
      if (!role) {
        return {
          success: false,
          message: "Role not found in this event",
        };
      }

      // 3. Check if user already signed up for this role
      const isAlreadySignedUp = role.currentSignups.some(
        (signup) => signup.userId.toString() === userId.toString()
      );
      if (isAlreadySignedUp) {
        return {
          success: false,
          message: "User is already signed up for this role",
        };
      }

      // 4. Check role capacity (CRITICAL: This is now atomic!)
      if (role.currentSignups.length >= role.maxParticipants) {
        return {
          success: false,
          message: "This role is already full",
        };
      }

      // 5. Add user to role (Event collection)
      role.currentSignups.push(userData as IEventParticipant);
      await event.save();

      // 6. Create/update registration record (Registration collection)
      let registration = await Registration.findOne({
        userId,
        eventId: event._id,
        roleId,
      });

      if (registration) {
        // Reactivate existing registration
        registration.status = "active";
        registration.notes = registrationData.notes || registration.notes;
        registration.specialRequirements =
          registrationData.specialRequirements ||
          registration.specialRequirements;
        registration.addAuditEntry(
          "registered",
          registrationData.registeredBy,
          "Re-registered for role after previous cancellation"
        );
        await registration.save();
      } else {
        // Create new registration
        registration = new Registration({
          userId,
          eventId: event._id,
          roleId,
          userSnapshot: registrationData.userSnapshot,
          eventSnapshot: registrationData.eventSnapshot,
          status: "active",
          notes: registrationData.notes,
          specialRequirements: registrationData.specialRequirements,
          registeredBy: registrationData.registeredBy,
        });
        await registration.save();
      }

      // 7. Return success with updated event
      const updatedEvent = await Event.findById(eventId);
      return {
        success: true,
        event: updatedEvent!,
        message: "Successfully signed up for the event!",
        data: { registration },
      };
    } catch (error: any) {
      console.error("Thread-safe signup error:", error);
      return {
        success: false,
        message: error.message || "Failed to sign up for event",
      };
    }
  }

  private static async executeCancel(
    eventId: string,
    { userId, roleId }: ICancelData
  ): Promise<IEventOperationResult> {
    try {
      // 1. Find event
      const event = await Event.findById(eventId);
      if (!event) {
        return {
          success: false,
          message: "Event not found",
        };
      }

      // 2. Find role and remove user
      const role = event.roles.find((r) => r.id === roleId);
      if (!role) {
        return {
          success: false,
          message: "Role not found",
        };
      }

      // 3. Remove user from role
      const originalLength = role.currentSignups.length;
      role.currentSignups = role.currentSignups.filter(
        (signup) => signup.userId.toString() !== userId.toString()
      );

      if (role.currentSignups.length === originalLength) {
        return {
          success: false,
          message: "User was not signed up for this role",
        };
      }

      await event.save();

      // 4. Delete registration record
      await Registration.findOneAndDelete({
        userId,
        eventId: event._id,
        roleId,
        status: "active",
      });

      // 5. Return success with updated event
      const updatedEvent = await Event.findById(eventId);
      return {
        success: true,
        event: updatedEvent!,
        message: "Successfully cancelled your event signup",
        data: { cancelledRole: role.name },
      };
    } catch (error: any) {
      console.error("Thread-safe cancel error:", error);
      return {
        success: false,
        message: error.message || "Failed to cancel signup",
      };
    }
  }

  private static async executeRemoval(
    eventId: string,
    targetUserId: mongoose.Types.ObjectId,
    roleId: string,
    removedBy: mongoose.Types.ObjectId
  ): Promise<IEventOperationResult> {
    try {
      // Similar to cancel but with admin audit trail
      const event = await Event.findById(eventId);
      if (!event) {
        return {
          success: false,
          message: "Event not found",
        };
      }

      const role = event.roles.find((r) => r.id === roleId);
      if (!role) {
        return {
          success: false,
          message: "Role not found",
        };
      }

      // Remove user
      const userIndex = role.currentSignups.findIndex(
        (user) => user.userId.toString() === targetUserId.toString()
      );

      if (userIndex === -1) {
        return {
          success: false,
          message: "User not found in this role",
        };
      }

      const removedUser = role.currentSignups[userIndex];
      role.currentSignups.splice(userIndex, 1);
      await event.save();

      // Update registration with admin removal
      const registration = await Registration.findOne({
        userId: targetUserId,
        eventId: event._id,
        roleId,
        status: "active",
      });

      if (registration) {
        registration.addAuditEntry(
          "admin_removed",
          removedBy,
          `Removed by admin from role: ${role.name}`
        );
        await Registration.findByIdAndDelete(registration._id);
      }

      const updatedEvent = await Event.findById(eventId);
      return {
        success: true,
        event: updatedEvent || undefined,
        message: "User successfully removed from role",
        data: {
          removedUser: `${removedUser.firstName} ${removedUser.lastName}`,
          roleName: role.name,
        },
      };
    } catch (error: any) {
      console.error("Thread-safe removal error:", error);
      return {
        success: false,
        message: error.message || "Failed to remove user",
      };
    }
  }

  private static async executeMove(
    eventId: string,
    userId: mongoose.Types.ObjectId,
    fromRoleId: string,
    toRoleId: string,
    movedBy: mongoose.Types.ObjectId
  ): Promise<IEventOperationResult> {
    try {
      const event = await Event.findById(eventId);
      if (!event) {
        return {
          success: false,
          message: "Event not found",
        };
      }

      const fromRole = event.roles.find((r) => r.id === fromRoleId);
      const toRole = event.roles.find((r) => r.id === toRoleId);

      if (!fromRole || !toRole) {
        return {
          success: false,
          message: "One or both roles not found",
        };
      }

      // Check target role capacity
      if (toRole.currentSignups.length >= toRole.maxParticipants) {
        return {
          success: false,
          message: "Target role is at full capacity",
        };
      }

      // Find and move user
      const userIndex = fromRole.currentSignups.findIndex(
        (user) => user.userId.toString() === userId.toString()
      );

      if (userIndex === -1) {
        return {
          success: false,
          message: "User not found in source role",
        };
      }

      const user = fromRole.currentSignups[userIndex];
      fromRole.currentSignups.splice(userIndex, 1);
      toRole.currentSignups.push(user);

      await event.save();

      // Update registration record
      const registration = await Registration.findOne({
        userId,
        eventId: event._id,
        roleId: fromRoleId,
        status: "active",
      });

      if (registration) {
        registration.roleId = toRoleId;
        registration.eventSnapshot.roleName = toRole.name;
        registration.eventSnapshot.roleDescription = toRole.description;
        registration.addAuditEntry(
          "moved_between_roles",
          movedBy,
          `Moved from ${fromRole.name} to ${toRole.name}`
        );
        await registration.save();
      }

      const finalEvent = await Event.findById(eventId);
      return {
        success: true,
        event: finalEvent || undefined,
        message: "User successfully moved between roles",
        data: {
          userName: `${user.firstName} ${user.lastName}`,
          fromRole: fromRole.name,
          toRole: toRole.name,
        },
      };
    } catch (error: any) {
      console.error("Thread-safe move error:", error);
      return {
        success: false,
        message: error.message || "Failed to move user",
      };
    }
  }
}
