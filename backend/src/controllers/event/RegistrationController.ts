import { Request, Response } from "express";
import mongoose from "mongoose";
import { Event, Registration, User, IEventRole } from "../../models";
import { PERMISSIONS, hasPermission } from "../../utils/roleUtils";
import { CorrelatedLogger } from "../../services/CorrelatedLogger";
import { lockService } from "../../services/LockService";
import { socketService } from "../../services/infrastructure/SocketService";
import { EmailService } from "../../services/infrastructure/EmailServiceFacade";
import { TrioNotificationService } from "../../services/notifications/TrioNotificationService";
import { ResponseBuilderService } from "../../services/ResponseBuilderService";
import { CachePatterns } from "../../services";
import { createRoleAssignmentRejectionToken } from "../../utils/roleAssignmentRejectionToken";
import { EventController } from "../eventController";
import AuditLog from "../../models/AuditLog";
import {
  getMaxRolesPerEvent,
  getMaxRolesDescription,
} from "../../utils/roleRegistrationLimits";

interface EventSignupRequest {
  roleId: string;
  notes?: string;
  specialRequirements?: string;
}

/**
 * RegistrationController
 *
 * Handles user registration and role management for events:
 * - signUpForEvent: Register user for an event role (thread-safe)
 * - cancelSignup: Cancel user's registration
 * - removeUserFromRole: Remove user from a role (admin action)
 * - assignUserToRole: Assign user to a role (admin action)
 */
export class RegistrationController {
  static async signUpForEvent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { roleId, notes, specialRequirements }: EventSignupRequest =
        req.body;

      // Basic validation
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid event ID.",
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      if (!roleId) {
        res.status(400).json({
          success: false,
          message: "Role ID is required.",
        });
        return;
      }

      // Pre-flight checks (before acquiring lock)
      const event = await Event.findById(id);
      if (!event) {
        res.status(404).json({
          success: false,
          message: "Event not found.",
        });
        return;
      }

      if (event.status !== "upcoming") {
        res.status(400).json({
          success: false,
          message: "Cannot sign up for this event.",
        });
        return;
      }

      // Role limit logic removed: no per-user role count pre-check needed.

      // NOTE: Per-authorization role count limits removed. Users may now hold
      // multiple roles within the same event as long as each role is unique
      // and capacity constraints are respected. Duplicate registration checks
      // later in the flow still prevent the same role from being taken twice.

      // Role permission checks
      const targetRole = event.roles.find(
        (role: IEventRole) => role.id === roleId,
      );
      if (!targetRole) {
        res.status(400).json({
          success: false,
          message: "Role not found in this event.",
        });
        return;
      }

      // NOTE: Participant-specific role eligibility restrictions have been removed.
      // Any authenticated user may now sign up for any role (capacity & duplicate
      // safeguards still apply). Historical gating logic intentionally deleted
      // to align with new universal role access requirement.

      // NEW POLICY (2025-10-10): Role-based registration limits per event:
      // - Super Admin & Administrator: Unlimited
      // - Leader: 5 roles
      // - Guest Expert: 4 roles
      // - Participant: 3 roles
      // Enforce here before attempting capacity lock. Duplicate role prevention
      // is still handled separately.
      const maxRoles = getMaxRolesPerEvent(req.user.role);
      const userExistingRoleCount = await Registration.countDocuments({
        eventId: id,
        userId: req.user._id,
      });

      if (userExistingRoleCount >= maxRoles) {
        res.status(400).json({
          success: false,
          message: `Role limit reached: you already hold ${userExistingRoleCount} role${
            userExistingRoleCount !== 1 ? "s" : ""
          } in this event (${getMaxRolesDescription(req.user.role)}) as ${
            req.user.role
          }.`,
        });
        return;
      }

      // Pre-lock capacity check (restored for deterministic unit test expectations and
      // to short-circuit obvious full roles before attempting lock acquisition).
      // A second check still occurs inside the lock to prevent race conditions.
      const preLockCount = await Registration.countDocuments({
        eventId: id,
        roleId,
      });
      if (preLockCount >= targetRole.maxParticipants) {
        res.status(400).json({
          success: false,
          message: `This role is at full capacity (${preLockCount}/${targetRole.maxParticipants}). Please try another role.`,
        });
        return;
      }

      // 🔒 THREAD-SAFE REGISTRATION WITH APPLICATION LOCK 🔒
      // Use application-level locking for capacity-safe registration
      const lockKey = `signup:${id}:${roleId}`;
      const user = req.user!; // Already validated above

      try {
        await lockService.withLock(
          lockKey,
          async () => {
            // Final capacity check under lock (race condition protection) - no status filtering needed
            const currentCount = await Registration.countDocuments({
              eventId: id,
              roleId,
            });

            if (currentCount >= targetRole.maxParticipants) {
              throw new Error(
                `This role is at full capacity (${currentCount}/${targetRole.maxParticipants}). Please try another role.`,
              );
            }

            // Check for duplicate registration under lock (no status filtering needed)
            const existingRegistration = await Registration.findOne({
              eventId: id,
              userId: user._id,
              roleId,
            });

            if (existingRegistration) {
              throw new Error("You are already signed up for this role.");
            }

            // Create new registration record
            const newRegistration = new Registration({
              eventId: id,
              userId: user._id,
              roleId,
              registrationDate: new Date(),
              notes,
              specialRequirements,
              registeredBy: user._id,
              userSnapshot: {
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                systemAuthorizationLevel: user.role,
                roleInAtCloud: user.roleInAtCloud,
                avatar: user.avatar,
                gender: user.gender,
              },
              eventSnapshot: await (async () => {
                const { EventSnapshotBuilder } =
                  await import("../../services/EventSnapshotBuilder");
                return EventSnapshotBuilder.buildRegistrationSnapshot(
                  event,
                  targetRole,
                );
              })(),
            });

            // Attempt atomic save (protected by unique index for duplicates)
            console.log(
              `🔄 Saving registration for user ${user._id} to role ${roleId} in event ${id}`,
            );
            await newRegistration.save();
            console.log(`✅ Registration saved successfully`);

            // Update the Event document to trigger statistics recalculation
            console.log(`🔄 Updating event statistics...`);
            await event.save(); // This triggers the pre-save hook to update signedUp and totalSlots
            console.log(`✅ Event statistics updated`);

            return newRegistration;
          },
          10000,
        ); // 10 second timeout

        // Get updated event data using ResponseBuilderService
        console.log(`🔄 Building updated event data with registrations...`);
        const updatedEvent =
          await ResponseBuilderService.buildEventWithRegistrations(
            id,
            req.user ? EventController.toIdString(req.user._id) : undefined,
            (req.user as { role?: string } | undefined)?.role,
          );
        console.log(`✅ Updated event data built:`, {
          eventId: id,
          roleCount: updatedEvent?.roles?.length,
          targetRoleSignups: updatedEvent?.roles?.find((r) => r.id === roleId)
            ?.registrations?.length,
        });

        // Emit real-time event update for signup
        console.log(`📡 Emitting WebSocket event update for signup...`);
        socketService.emitEventUpdate(id, "user_signed_up", {
          userId: user._id,
          roleId,
          roleName: targetRole.name,
          user: {
            userId: user._id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
          },
          event: updatedEvent,
        });
        console.log(`✅ WebSocket event emitted successfully`);

        // Invalidate caches after successful signup
        await CachePatterns.invalidateEventCache(id);
        await CachePatterns.invalidateAnalyticsCache();

        res.status(200).json({
          success: true,
          message: `Successfully signed up for ${targetRole.name}`,
          data: {
            event: updatedEvent,
          },
        });
      } catch (lockError: unknown) {
        if (
          typeof lockError === "object" &&
          lockError !== null &&
          typeof (lockError as { message?: unknown }).message === "string" &&
          (lockError as { message: string }).message.includes("Lock timeout")
        ) {
          res.status(503).json({
            success: false,
            message:
              "Service temporarily unavailable due to high load. Please try again.",
          });
          return;
        }

        if (
          typeof lockError === "object" &&
          lockError !== null &&
          typeof (lockError as { message?: unknown }).message === "string" &&
          ((lockError as { message: string }).message.includes(
            "already signed up",
          ) ||
            (lockError as { message: string }).message.includes(
              "full capacity",
            ))
        ) {
          const msg = (lockError as { message: string }).message;
          res.status(400).json({
            success: false,
            message: msg,
          });
          return;
        }

        throw lockError; // Re-throw unexpected errors
      }
    } catch (error: unknown) {
      console.error("Event signup error:", error);
      CorrelatedLogger.fromRequest(req, "EventController").error(
        "signUpForEvent failed",
        error as Error,
        undefined,
        { eventId: req.params?.id },
      );

      if (
        typeof error === "object" &&
        error !== null &&
        typeof (error as { message?: unknown }).message === "string" &&
        ((error as { message: string }).message.includes("already signed up") ||
          (error as { message: string }).message.includes("already full") ||
          (error as { message: string }).message.includes("timeout"))
      ) {
        res.status(400).json({
          success: false,
          message: (error as { message: string }).message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: "Failed to sign up for event.",
      });
    }
  }

  // Update a specific workshop group topic (Workshop only)
  static async updateWorkshopGroupTopic(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const { id, group } = req.params as { id: string; group: string };
      const { topic } = req.body as { topic: string };

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ success: false, message: "Invalid event ID." });
        return;
      }
      const validGroups = ["A", "B", "C", "D", "E", "F"] as const;
      if (!validGroups.some((g) => g === group)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid group key. Must be A-F." });
        return;
      }
      const event = await Event.findById(id);
      if (!event) {
        res.status(404).json({ success: false, message: "Event not found." });
        return;
      }
      if (event.type !== "Effective Communication Workshop") {
        res.status(400).json({
          success: false,
          message:
            "Group topics are only for Effective Communication Workshop events.",
        });
        return;
      }
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }

      const user = req.user;
      let authorized = false;
      if (user.role === "Super Admin" || user.role === "Administrator") {
        authorized = true;
      }
      if (
        !authorized &&
        event.createdBy?.toString() === EventController.toIdString(user._id)
      ) {
        authorized = true;
      }
      if (!authorized && Array.isArray(event.organizerDetails)) {
        authorized = event.organizerDetails.some(
          (o: { userId?: unknown }) =>
            (o.userId ? EventController.toIdString(o.userId) : undefined) ===
            EventController.toIdString(user._id),
        );
      }
      if (!authorized) {
        // Check if user is registered as Group X Leader for this event
        const leaderRoleName = `Group ${group} Leader`;
        const leaderRole = event.roles.find(
          (r: { id: string; name: string }) => r.name === leaderRoleName,
        );
        if (leaderRole) {
          const count = await Registration.countDocuments({
            eventId: id,
            roleId: leaderRole.id,
            userId: user._id,
          });
          if (count > 0) authorized = true;
        }
      }

      if (!authorized) {
        res.status(403).json({
          success: false,
          message: "You do not have permission to edit this group topic.",
        });
        return;
      }

      const key = `workshopGroupTopics.${group}`;
      await Event.findByIdAndUpdate(
        id,
        { $set: { [key]: (topic ?? "").toString().trim() } },
        { new: true, runValidators: true, context: "query" },
      );

      // Build fresh event response and emit socket update
      const updatedEvent =
        await ResponseBuilderService.buildEventWithRegistrations(
          id,
          req.user ? EventController.toIdString(req.user._id) : undefined,
          (req.user as { role?: string } | undefined)?.role,
        );
      await CachePatterns.invalidateEventCache(id);
      socketService.emitEventUpdate(id, "workshop_topic_updated", {
        group,
        topic,
        userId: req.user ? EventController.toIdString(req.user._id) : undefined,
      });

      res.status(200).json({
        success: true,
        message: "Group topic updated",
        data: { event: updatedEvent },
      });
    } catch (error: unknown) {
      console.error("Update workshop topic error:", error);
      CorrelatedLogger.fromRequest(req, "EventController").error(
        "updateWorkshopGroupTopic failed",
        error as Error,
        undefined,
        {
          eventId: req.params?.id,
          group: (req.params as { group?: string })?.group,
        },
      );
      if (
        typeof error === "object" &&
        error !== null &&
        (error as { name?: unknown }).name === "ValidationError"
      ) {
        const errors = Object.values(
          (error as { errors?: Record<string, { message?: string }> }).errors ||
            {},
        ).map((e) => e.message || "Validation error");
        res
          .status(400)
          .json({ success: false, message: "Invalid topic", errors });
        return;
      }
      res
        .status(500)
        .json({ success: false, message: "Failed to update group topic." });
    }
  }

  // Cancel event signup (THREAD-SAFE VERSION)
  static async cancelSignup(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { roleId } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid event ID.",
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      // Basic validation
      const event = await Event.findById(id);
      if (!event) {
        res.status(404).json({
          success: false,
          message: "Event not found.",
        });
        return;
      }

      const role = event.roles.find((r: IEventRole) => r.id === roleId);
      if (!role) {
        res.status(404).json({
          success: false,
          message: "Role not found.",
        });
        return;
      }

      // 🔒 REGISTRATION-BASED CANCELLATION (ATOMIC OPERATION) 🔒
      // Remove registration record - this is atomic and thread-safe
      const deletedRegistration = await Registration.findOneAndDelete({
        eventId: id,
        userId: req.user._id,
        roleId,
      });

      if (!deletedRegistration) {
        res.status(400).json({
          success: false,
          message: "You are not signed up for this role.",
        });
        return;
      }

      // Update the Event document to trigger statistics recalculation
      await event.save(); // This triggers the pre-save hook to update signedUp and totalSlots

      // Invalidate caches after cancellation
      await CachePatterns.invalidateEventCache(id);
      await CachePatterns.invalidateAnalyticsCache();

      // Get updated event data using ResponseBuilderService
      const updatedEvent =
        await ResponseBuilderService.buildEventWithRegistrations(
          id,
          req.user ? EventController.toIdString(req.user._id) : undefined,
          (req.user as { role?: string } | undefined)?.role,
        );

      // Emit real-time event update for cancellation
      socketService.emitEventUpdate(id, "user_cancelled", {
        userId: req.user._id,
        roleId,
        roleName: role.name,
        event: updatedEvent,
      });

      res.status(200).json({
        success: true,
        message: `Successfully cancelled signup for ${role.name}`,
        data: {
          event: updatedEvent,
        },
      });
    } catch (error: unknown) {
      console.error("Cancel signup error:", error);
      CorrelatedLogger.fromRequest(req, "EventController").error(
        "cancelSignup failed",
        error as Error,
        undefined,
        { eventId: req.params?.id },
      );
      res.status(500).json({
        success: false,
        message: "Failed to cancel signup.",
      });
    }
  }

  // Remove user from role (admin/organizer management operation)
  static async removeUserFromRole(req: Request, res: Response): Promise<void> {
    try {
      const { id: eventId } = req.params;
      const { userId, roleId } = req.body;

      const event = await Event.findById(eventId);
      if (!event) {
        res.status(404).json({
          success: false,
          message: "Event not found",
        });
        return;
      }

      // Verify role exists
      const role = event.roles.find((r: IEventRole) => r.id === roleId);
      if (!role) {
        res.status(404).json({
          success: false,
          message: "Role not found",
        });
        return;
      }

      // Remove the registration record (this is our single source of truth)
      const deletedRegistration = await Registration.findOneAndDelete({
        userId: new mongoose.Types.ObjectId(userId),
        eventId: event._id,
        roleId,
      });

      if (!deletedRegistration) {
        res.status(404).json({
          success: false,
          message: "Registration not found",
        });
        return;
      }

      // Update the Event document to trigger statistics recalculation
      await event.save(); // This triggers the pre-save hook to update signedUp and totalSlots

      // Invalidate caches after user removal
      await CachePatterns.invalidateEventCache(eventId);
      await CachePatterns.invalidateAnalyticsCache();

      // Build updated event for the acting viewer
      const updatedEvent =
        await ResponseBuilderService.buildEventWithRegistrations(
          eventId,
          req.user ? EventController.toIdString(req.user._id) : undefined,
          (req.user as { role?: string } | undefined)?.role,
        );

      // Emit real-time event update to all connected clients
      socketService.emitEventUpdate(eventId, "user_removed", {
        userId,
        roleId,
        roleName: role.name,
        event: updatedEvent,
      });

      // Trio notification (best effort)
      try {
        const removedUser = (await User.findById(userId).lean()) as {
          _id: unknown;
          email?: string;
          firstName?: string;
          lastName?: string;
        } | null;
        if (removedUser) {
          await TrioNotificationService.createEventRoleRemovedTrio({
            event: { id: event._id.toString(), title: event.title },
            targetUser: {
              id: EventController.toIdString(removedUser._id),
              email: removedUser.email || "",
              firstName: removedUser.firstName || "",
              lastName: removedUser.lastName || "",
            },
            roleName: role.name,
            actor: {
              id:
                req.user && req.user._id
                  ? EventController.toIdString(req.user._id)
                  : "system",
              firstName: req.user?.firstName || "System",
              lastName: req.user?.lastName || "",
              username: req.user?.username || "system",
              avatar: req.user?.avatar,
              gender: req.user?.gender,
              authLevel: req.user?.role,
              roleInAtCloud: req.user?.roleInAtCloud,
            },
          });
        }
      } catch (trioErr) {
        console.warn("Trio role removed notification failed:", trioErr);
      }

      res.status(200).json({
        success: true,
        message: `User removed from ${role.name} successfully`,
        data: { event: updatedEvent },
      });
    } catch (error: unknown) {
      console.error("Remove user from role error:", error);
      CorrelatedLogger.fromRequest(req, "EventController").error(
        "removeUserFromRole failed",
        error as Error,
        undefined,
        { eventId: req.params?.id },
      );
      res.status(500).json({
        success: false,
        message:
          (typeof error === "object" &&
            error !== null &&
            typeof (error as { message?: unknown }).message === "string" &&
            (error as { message: string }).message) ||
          "Failed to remove user from role",
      });
    }
  }

  // Move user between roles (admin/organizer management operation)
  static async moveUserBetweenRoles(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const { id: eventId } = req.params;
      const { userId, fromRoleId, toRoleId } = req.body;

      const event = await Event.findById(eventId);
      if (!event) {
        res.status(404).json({
          success: false,
          message: "Event not found",
        });
        return;
      }

      const sourceRole = event.roles.find(
        (r: IEventRole) => r.id === fromRoleId,
      );
      const targetRole = event.roles.find((r: IEventRole) => r.id === toRoleId);

      if (!sourceRole || !targetRole) {
        res.status(404).json({
          success: false,
          message: "Source or target role not found",
        });
        return;
      }

      // Check if user is registered for source role
      const existingRegistration = await Registration.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        eventId: event._id,
        roleId: fromRoleId,
      });

      if (!existingRegistration) {
        res.status(404).json({
          success: false,
          message: "User not found in source role",
        });
        return;
      }

      // 🔒 ENHANCED CAPACITY-SAFE ROLE MOVE 🔒
      // Pre-check target role capacity (reduces race condition window)
      const currentCount = await Registration.countDocuments({
        eventId: event._id,
        roleId: toRoleId,
      });

      if (currentCount >= targetRole.maxParticipants) {
        res.status(400).json({
          success: false,
          message: `Target role is at full capacity (${currentCount}/${targetRole.maxParticipants})`,
        });
        return;
      }

      try {
        // Update registration record to move to new role (atomic operation)
        existingRegistration.roleId = toRoleId;
        // Update the event snapshot to reflect the new role
        existingRegistration.eventSnapshot.roleName = targetRole.name;
        existingRegistration.eventSnapshot.roleDescription =
          targetRole.description;

        await existingRegistration.save();

        // Update the Event document to trigger statistics recalculation
        await event.save(); // This triggers the pre-save hook to update signedUp and totalSlots

        // Invalidate caches after role switch
        await CachePatterns.invalidateEventCache(eventId);
        await CachePatterns.invalidateAnalyticsCache();

        // Get updated event data using ResponseBuilderService
        const updatedEvent =
          await ResponseBuilderService.buildEventWithRegistrations(
            eventId,
            req.user ? EventController.toIdString(req.user._id) : undefined,
            (req.user as { role?: string } | undefined)?.role,
          );

        // Emit real-time event update to all connected clients
        socketService.emitEventUpdate(eventId, "user_moved", {
          userId,
          fromRoleId,
          toRoleId,
          fromRoleName: sourceRole.name,
          toRoleName: targetRole.name,
          event: updatedEvent,
        });

        // Trio notification (best effort)
        try {
          const movedUser = (await User.findById(userId).lean()) as {
            _id: unknown;
            email?: string;
            firstName?: string;
            lastName?: string;
          } | null;
          if (movedUser) {
            await TrioNotificationService.createEventRoleMovedTrio({
              event: {
                id: event._id.toString(),
                _id: event._id.toString(), // Include _id for ICS generation
                title: event.title,
                date: event.date,
                endDate: event.endDate, // Include endDate for ICS generation
                time: event.time,
                endTime: event.endTime, // Include endTime for ICS generation
                timeZone: event.timeZone,
                location: event.location,
                purpose: event.purpose, // Include purpose for ICS generation
                // Include virtual meeting fields for comprehensive email details
                format: event.format,
                isHybrid: event.isHybrid,
                zoomLink: event.zoomLink,
                meetingId: event.meetingId,
                passcode: event.passcode,
              },
              targetUser: {
                id: EventController.toIdString(movedUser._id),
                email: movedUser.email || "",
                firstName: movedUser.firstName || "",
                lastName: movedUser.lastName || "",
              },
              fromRoleName: sourceRole.name,
              toRoleName: targetRole.name,
              actor: {
                id:
                  req.user && req.user._id
                    ? EventController.toIdString(req.user._id)
                    : "system",
                firstName: req.user?.firstName || "System",
                lastName: req.user?.lastName || "",
                username: req.user?.username || "system",
                avatar: req.user?.avatar,
                gender: req.user?.gender,
                authLevel: req.user?.role,
                roleInAtCloud: req.user?.roleInAtCloud,
              },
            });
          }
        } catch (trioErr) {
          console.warn("Trio role moved notification failed:", trioErr);
        }

        res.status(200).json({
          success: true,
          message: "User moved between roles successfully",
          data: { event: updatedEvent },
        });
      } catch (moveError: unknown) {
        // Handle potential capacity race condition or write conflicts for role moves
        let finalCount = -1;
        try {
          finalCount = await Registration.countDocuments({
            eventId: event._id,
            roleId: toRoleId,
          });
        } catch {
          // If counting fails, fall through to message-based heuristics
        }

        const moveErrMsg =
          typeof moveError === "object" &&
          moveError !== null &&
          typeof (moveError as { message?: unknown }).message === "string"
            ? (moveError as { message: string }).message
            : "";

        const capacityRace =
          finalCount >= 0 && finalCount >= targetRole.maxParticipants;
        const writeConflictHeuristic = /write conflict/i.test(moveErrMsg);

        if (capacityRace || writeConflictHeuristic) {
          res.status(400).json({
            success: false,
            message: `Target role became full while processing move (${
              finalCount >= 0
                ? `${finalCount}/${targetRole.maxParticipants}`
                : `max ${targetRole.maxParticipants}`
            })`,
          });
          return;
        }

        // Non-capacity, non-conflict error -> bubble to outer catch for 500
        throw moveError;
      }
    } catch (error: unknown) {
      console.error("Move user between roles error:", error);
      CorrelatedLogger.fromRequest(req, "EventController").error(
        "moveUserBetweenRoles failed",
        error as Error,
        undefined,
        { eventId: req.params?.id },
      );
      res.status(500).json({
        success: false,
        message:
          (typeof error === "object" &&
            error !== null &&
            typeof (error as { message?: unknown }).message === "string" &&
            (error as { message: string }).message) ||
          "Failed to move user between roles",
      });
    }
  }

  // Assign user to role (organizers/co-organizers only)
  static async assignUserToRole(req: Request, res: Response): Promise<void> {
    try {
      const { id: eventId } = req.params;
      const {
        userId,
        roleId,
        notes,
        specialRequirements,
        suppressNotifications,
      } = req.body as {
        userId: string;
        roleId: string;
        notes?: string;
        specialRequirements?: string;
        suppressNotifications?: boolean;
      };

      if (!mongoose.Types.ObjectId.isValid(eventId)) {
        res.status(400).json({ success: false, message: "Invalid event ID." });
        return;
      }
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json({ success: false, message: "Invalid user ID." });
        return;
      }
      if (!roleId) {
        res
          .status(400)
          .json({ success: false, message: "Role ID is required." });
        return;
      }

      const event = await Event.findById(eventId);
      if (!event) {
        res.status(404).json({ success: false, message: "Event not found" });
        return;
      }

      // Authorizer middleware already ensures req.user is organizer or super admin
      const targetRole = event.roles.find((r: IEventRole) => r.id === roleId);
      if (!targetRole) {
        res.status(404).json({ success: false, message: "Role not found" });
        return;
      }

      // Ensure event is upcoming
      if (event.status !== "upcoming") {
        res.status(400).json({
          success: false,
          message: "Cannot assign users to a non-upcoming event.",
        });
        return;
      }

      // Fetch target user
      const targetUser = await User.findById(userId);
      if (!targetUser) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }
      if (!targetUser.isActive || !targetUser.isVerified) {
        res.status(400).json({
          success: false,
          message: "User is inactive or not verified.",
        });
        return;
      }

      // Eligibility: reuse sign-up rules for Participants vs other roles depending on event type
      const roleName = targetRole.name;
      // NOTE: Participant-specific eligibility restrictions for organizer assignment
      // have been removed. Organizers may assign any active & verified user to any
      // role provided standard checks (event status, capacity, duplicate) pass.

      // Idempotency: if already registered to this role, return success with current state
      const existingRegistration = await Registration.findOne({
        eventId: event._id,
        userId: targetUser._id,
        roleId,
      });
      if (existingRegistration) {
        const updatedEvent =
          await ResponseBuilderService.buildEventWithRegistrations(
            eventId,
            req.user ? EventController.toIdString(req.user._id) : undefined,
            (req.user as { role?: string } | undefined)?.role,
          );
        res.status(200).json({
          success: true,
          message: `${
            targetUser.getDisplayName?.() || targetUser.username
          } is already assigned to ${roleName}`,
          data: { event: updatedEvent },
        });
        return;
      }

      // Capacity check
      const currentCount = await Registration.countDocuments({
        eventId: event._id,
        roleId,
      });
      if (currentCount >= targetRole.maxParticipants) {
        res.status(400).json({
          success: false,
          message: `This role is at full capacity (${currentCount}/${targetRole.maxParticipants}).`,
        });
        return;
      }

      // Create registration on behalf of the organizer
      const actingUser = req.user!;
      const reg = new Registration({
        eventId: event._id,
        userId: targetUser._id,
        roleId,
        registrationDate: new Date(),
        notes,
        specialRequirements,
        registeredBy: actingUser._id,
        userSnapshot: {
          username: targetUser.username,
          firstName: targetUser.firstName,
          lastName: targetUser.lastName,
          email: targetUser.email,
          systemAuthorizationLevel: targetUser.role,
          roleInAtCloud: targetUser.roleInAtCloud,
          avatar: targetUser.avatar,
          gender: targetUser.gender,
        },
        eventSnapshot: await (async () => {
          const { EventSnapshotBuilder } =
            await import("../../services/EventSnapshotBuilder");
          return EventSnapshotBuilder.buildRegistrationSnapshot(
            event,
            targetRole,
          );
        })(),
      });

      // Add explicit audit entry for assignment
      reg.addAuditEntry(
        "assigned",
        actingUser._id,
        `Assigned to role: ${targetRole.name}`,
      );
      await reg.save();

      // Update event stats
      await event.save();

      // Build updated response and emit socket event
      const updatedEvent =
        await ResponseBuilderService.buildEventWithRegistrations(
          eventId,
          req.user ? EventController.toIdString(req.user._id) : undefined,
          (req.user as { role?: string } | undefined)?.role,
        );
      socketService.emitEventUpdate(eventId, "user_assigned", {
        operatorId: EventController.toIdString(actingUser._id),
        userId: EventController.toIdString(targetUser._id),
        roleId,
        roleName,
        event: updatedEvent,
      });

      // Trio notification (best effort) - skip if notifications are suppressed
      if (!suppressNotifications) {
        try {
          // Generate role assignment rejection token for email link (14-day default TTL)
          let rejectionToken: string | undefined;
          try {
            const regId =
              typeof reg._id?.toString === "function"
                ? reg._id.toString()
                : undefined;
            const assigneeId =
              typeof targetUser._id?.toString === "function"
                ? targetUser._id.toString()
                : undefined;
            if (regId && assigneeId) {
              rejectionToken = createRoleAssignmentRejectionToken({
                assignmentId: regId,
                assigneeId,
              });
            }
          } catch (tokErr) {
            // Non-fatal: proceed without token in tests or mocks missing _id
            if (process.env.NODE_ENV !== "test") {
              console.warn("Rejection token generation skipped:", tokErr);
            }
          }
          await TrioNotificationService.createEventRoleAssignedTrio({
            event: {
              id: event._id.toString(),
              _id: event._id.toString(), // Include _id for ICS generation
              title: event.title,
              date: event.date,
              endDate: event.endDate, // Include endDate for ICS generation
              time: event.time,
              endTime: event.endTime, // Include endTime for ICS generation
              // Prefer explicit event.timeZone if present. If missing (older events or test fixtures),
              // attempt to fall back to the freshly built updatedEvent (which normalizes schema).
              timeZone: (() => {
                const evUnknown: unknown = event;
                if (
                  typeof evUnknown === "object" &&
                  evUnknown !== null &&
                  typeof (evUnknown as { timeZone?: unknown }).timeZone ===
                    "string"
                ) {
                  return (evUnknown as { timeZone?: string }).timeZone;
                }
                const upUnknown: unknown = updatedEvent as unknown;
                if (
                  typeof upUnknown === "object" &&
                  upUnknown !== null &&
                  typeof (upUnknown as { timeZone?: unknown }).timeZone ===
                    "string"
                ) {
                  return (upUnknown as { timeZone?: string }).timeZone;
                }
                return undefined;
              })(),
              location: event.location,
              purpose: event.purpose, // Include purpose for ICS generation
              // Include virtual meeting fields for comprehensive email details
              format: event.format,
              isHybrid: event.isHybrid,
              zoomLink: event.zoomLink,
              meetingId: event.meetingId,
              passcode: event.passcode,
            },
            targetUser: {
              id: targetUser._id.toString(),
              email: targetUser.email,
              firstName: targetUser.firstName,
              lastName: targetUser.lastName,
            },
            roleName,
            actor: {
              id: EventController.toIdString(actingUser._id),
              firstName: actingUser.firstName || "",
              lastName: actingUser.lastName || "",
              username: actingUser.username || "",
              avatar: actingUser.avatar,
              gender: actingUser.gender,
              authLevel: actingUser.role,
              roleInAtCloud: actingUser.roleInAtCloud,
            },
            rejectionToken,
          });
        } catch (trioErr) {
          // Updated terminology: 'role invitation' replaces legacy 'role assigned'
          console.warn("Trio role invitation notification failed:", trioErr);
        }
      }

      // Invalidate caches
      await CachePatterns.invalidateEventCache(eventId);
      await CachePatterns.invalidateAnalyticsCache();

      res.status(200).json({
        success: true,
        message: `Assigned ${
          targetUser.getDisplayName?.() || targetUser.username
        } to ${roleName}`,
        data: { event: updatedEvent },
      });
    } catch (error: unknown) {
      console.error("Assign user to role error:", error);
      CorrelatedLogger.fromRequest(req, "EventController").error(
        "assignUserToRole failed",
        error as Error,
        undefined,
        { eventId: req.params?.id },
      );
      res.status(500).json({
        success: false,
        message:
          (typeof error === "object" &&
            error !== null &&
            typeof (error as { message?: unknown }).message === "string" &&
            (error as { message: string }).message) ||
          "Failed to assign user to role",
      });
    }
  }
}
