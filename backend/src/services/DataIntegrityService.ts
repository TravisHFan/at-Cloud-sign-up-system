/**
 * Data Integrity Monitor Service
 *
 * Provides monitoring and validation for event/registration consistency
 * Perfect for Atlas Free Tier deployment without transactions
 */

import { Event, Registration, GuestRegistration } from "../models";
import mongoose from "mongoose";
import { CachePatterns } from "./infrastructure/CacheService";

export interface IntegrityCheckResult {
  isConsistent: boolean;
  issues: Array<{
    type: "capacity_mismatch" | "orphaned_registration" | "missing_event";
    description: string;
    eventId?: string;
    registrationId?: string;
    suggested_action: string;
  }>;
  statistics: {
    totalEvents: number;
    totalRegistrations: number;
    checkedAt: Date;
  };
}

export class DataIntegrityService {
  /**
   * Perform comprehensive integrity check
   * Run this periodically or after high-traffic periods
   */
  static async checkIntegrity(): Promise<IntegrityCheckResult> {
    const result: IntegrityCheckResult = {
      isConsistent: true,
      issues: [],
      statistics: {
        totalEvents: 0,
        totalRegistrations: 0,
        checkedAt: new Date(),
      },
    };

    try {
      // Get basic statistics
      result.statistics.totalEvents = await Event.countDocuments();
      result.statistics.totalRegistrations = await Registration.countDocuments({
        status: "active",
      });

      // Check 1: Verify event capacity consistency
      await this.checkCapacityConsistency(result);

      // Check 2: Check for orphaned registrations
      await this.checkOrphanedRegistrations(result);

      // Check 3: Verify event statistics match actual registrations
      await this.checkStatisticsConsistency(result);

      result.isConsistent = result.issues.length === 0;
    } catch (error: unknown) {
      const err = error as { message?: string } | undefined;
      console.error("Integrity check failed:", error);
      result.issues.push({
        type: "capacity_mismatch",
        description: `Integrity check failed: ${
          err?.message || "Unknown error"
        }`,
        suggested_action: "Review system logs and retry",
      });
      result.isConsistent = false;
    }

    return result;
  }

  /**
   * Check if any events have over-capacity registrations
   */
  private static async checkCapacityConsistency(
    result: IntegrityCheckResult
  ): Promise<void> {
    const events = await Event.find({ status: "upcoming" });

    for (const event of events) {
      for (const role of event.roles) {
        const userCount = await Registration.countDocuments({
          eventId: event._id,
          roleId: role.id,
          status: "active",
        });
        const guestCount = await GuestRegistration.countDocuments({
          eventId: event._id,
          roleId: role.id,
          status: "active",
        });
        const actualCount = userCount + guestCount;

        if (actualCount > role.maxParticipants) {
          result.issues.push({
            type: "capacity_mismatch",
            description: `Event "${event.title}" role "${role.name}" has ${actualCount} registrations but max is ${role.maxParticipants}`,
            eventId: (event._id as mongoose.Types.ObjectId).toString(),
            suggested_action:
              "Review registrations and consider increasing capacity or moving excess users to waitlist",
          });
        }
      }
    }
  }

  /**
   * Check for registrations pointing to non-existent events
   */
  private static async checkOrphanedRegistrations(
    result: IntegrityCheckResult
  ): Promise<void> {
    const registrations = await Registration.find({ status: "active" }).select(
      "_id eventId"
    );

    for (const registration of registrations) {
      const eventExists = await Event.exists({ _id: registration.eventId });

      if (!eventExists) {
        result.issues.push({
          type: "orphaned_registration",
          description: `Registration ${(
            registration._id as mongoose.Types.ObjectId
          ).toString()} points to non-existent event ${registration.eventId}`,
          registrationId: (
            registration._id as mongoose.Types.ObjectId
          ).toString(),
          suggested_action:
            "Delete orphaned registration or restore missing event",
        });
      }
    }
  }

  /**
   * Check if event.signedUp matches actual registration count
   */
  private static async checkStatisticsConsistency(
    result: IntegrityCheckResult
  ): Promise<void> {
    const events = await Event.find({});

    for (const event of events) {
      const userCount = await Registration.countDocuments({
        eventId: event._id,
        status: "active",
      });
      const guestCount = await GuestRegistration.countDocuments({
        eventId: event._id,
        status: "active",
      });
      const actualCount = userCount + guestCount;

      if (event.signedUp !== actualCount) {
        result.issues.push({
          type: "capacity_mismatch",
          description: `Event "${event.title}" shows ${event.signedUp} signups but actual count is ${actualCount}`,
          eventId: (event._id as mongoose.Types.ObjectId).toString(),
          suggested_action: "Trigger event.save() to recalculate statistics",
        });
      }
    }
  }

  /**
   * Auto-repair minor inconsistencies
   * Use with caution - only fixes statistics mismatches
   */
  static async autoRepair(): Promise<{ repaired: number; skipped: number }> {
    let repaired = 0;
    let skipped = 0;

    try {
      const events = await Event.find({});

      for (const event of events) {
        const actualCount = await Registration.countDocuments({
          eventId: event._id,
          status: "active",
        });

        if (event.signedUp !== actualCount) {
          console.log(
            `Repairing event ${event._id}: ${event.signedUp} -> ${actualCount}`
          );
          await event.save(); // Triggers pre-save hook to recalculate
          // Invalidate event cache after repair
          await CachePatterns.invalidateEventCache(
            (event._id as mongoose.Types.ObjectId).toString()
          );
          await CachePatterns.invalidateAnalyticsCache();
          repaired++;
        }
      }
    } catch (error) {
      console.error("Auto-repair failed:", error);
      skipped++;
    }

    return { repaired, skipped };
  }

  /**
   * Get lock service statistics
   */
  static getLockStatistics() {
    // This would be imported from your lock service
    // return lockService.getLockStats();
    return {
      message: "Import lockService to get real statistics",
      suggestion: "Add: import { lockService } from './LockService'",
    };
  }
}

// Export for use in controllers or scheduled jobs
export const integrityService = new DataIntegrityService();
