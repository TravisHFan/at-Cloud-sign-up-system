import GuestRegistration, {
  IGuestRegistration,
} from "../models/GuestRegistration";
import User from "../models/User";
import mongoose from "mongoose";

/**
 * GuestMigrationService
 * Minimal scaffold for detecting and migrating guest registrations to a user
 */
export default class GuestMigrationService {
  // Find guest registrations eligible to migrate by email
  static async detectGuestRegistrationsByEmail(
    email: string
  ): Promise<IGuestRegistration[]> {
    return GuestRegistration.findEligibleForMigration(email);
  }

  // Validate if migration is safe to perform
  static async validateMigrationEligibility(userId: string, email: string) {
    const user = await User.findById(userId).select("_id email");
    if (!user) return { ok: false, reason: "User not found" } as const;
    const pending = await GuestRegistration.findEligibleForMigration(email);
    return { ok: true, count: pending.length } as const;
  }

  // Perform migration (scaffold): marks guest docs as completed and links to user
  static async performGuestToUserMigration(userId: string, email: string) {
    const filter = {
      email: email.toLowerCase(),
      migrationStatus: "pending" as const,
    };
    const now = new Date();
    const update = {
      $set: {
        migrationStatus: "completed" as const,
        migratedToUserId: userId,
        migrationDate: now,
      },
    };

    let session: mongoose.ClientSession | null = null;
    try {
      // Try transactional path first (works when MongoDB supports transactions)
      session = await mongoose.startSession();
      session.startTransaction();
      const txResult = await GuestRegistration.updateMany(filter, update, {
        session,
      });
      await session.commitTransaction();
      return { ok: true, modified: txResult.modifiedCount } as const;
    } catch (error) {
      // Fallback for environments without transactions (e.g., unit tests on standalone MongoDB)
      try {
        if (session) {
          try {
            await session.abortTransaction();
          } catch {}
          try {
            session.endSession();
          } catch {}
          session = null;
        }
        const nonTxResult = await GuestRegistration.updateMany(filter, update);
        return { ok: true, modified: nonTxResult.modifiedCount } as const;
      } catch (fallbackErr) {
        return {
          ok: false,
          error:
            (fallbackErr as any)?.message ||
            (error as any)?.message ||
            String(fallbackErr || error),
        } as const;
      }
    } finally {
      if (session) {
        try {
          session.endSession();
        } catch {}
      }
    }
  }
}
