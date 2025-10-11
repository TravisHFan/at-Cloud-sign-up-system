import { Message, IMessage } from "../models";
import { Logger } from "./LoggerService";

const logger = Logger.getInstance().child("MessageCleanupService");

export interface CleanupStats {
  deletedCount: number;
  scannedCount: number;
  deletionsByReason: {
    deletedByAllReceivers: number;
    lowPriorityExpired: number;
    mediumPriorityExpired: number;
    highPriorityExpired: number;
    seenAndExpired: number;
  };
  executionTimeMs: number;
}

/**
 * MessageCleanupService - Automated cleanup for System Messages
 *
 * Cleanup Rules:
 * 1. Marked as deleted by all receivers
 * 2. Priority Low and past 90 days
 * 3. Priority Medium and past 160 days
 * 4. Priority High and past 240 days
 * 5. Marked as deleted OR seen by all receivers, and past 60 days
 *
 * Design Considerations:
 * - Runs periodically (e.g., daily at 2 AM via cron/scheduler)
 * - Logs all deletions for audit trail
 * - Returns statistics for monitoring
 * - Non-blocking: failures don't crash the application
 */
export class MessageCleanupService {
  /**
   * Execute the automated cleanup based on defined rules
   */
  static async executeCleanup(): Promise<CleanupStats> {
    const startTime = Date.now();
    const stats: CleanupStats = {
      deletedCount: 0,
      scannedCount: 0,
      deletionsByReason: {
        deletedByAllReceivers: 0,
        lowPriorityExpired: 0,
        mediumPriorityExpired: 0,
        highPriorityExpired: 0,
        seenAndExpired: 0,
      },
      executionTimeMs: 0,
    };

    try {
      logger.info("Starting automated message cleanup...");

      // Calculate date thresholds
      const now = new Date();
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const oneHundredSixtyDaysAgo = new Date(
        now.getTime() - 160 * 24 * 60 * 60 * 1000
      );
      const twoHundredFortyDaysAgo = new Date(
        now.getTime() - 240 * 24 * 60 * 60 * 1000
      );

      // Fetch all messages for analysis
      const messages = await Message.find({}).lean();
      stats.scannedCount = messages.length;

      logger.info(`Scanned ${messages.length} messages for cleanup`);

      const messagesToDelete: string[] = [];

      for (const message of messages) {
        const msg = message as unknown as IMessage & {
          userStates: Record<string, unknown> | Map<string, unknown>;
        };
        const messageId = String(msg._id);

        // Convert userStates to array of values
        // When using .lean(), Mongoose returns userStates as a plain object, not a Map
        const userStates = msg.userStates || {};
        const userStateArray = Object.values(userStates);

        // Skip if no user states (no receivers)
        if (userStateArray.length === 0) {
          continue;
        }

        // Rule 1: Deleted by all receivers
        const allDeleted = userStateArray.every(
          (state: {
            isDeletedFromSystem?: boolean;
            isRemovedFromBell?: boolean;
          }) =>
            state.isDeletedFromSystem === true ||
            state.isRemovedFromBell === true
        );

        if (allDeleted) {
          messagesToDelete.push(messageId);
          stats.deletionsByReason.deletedByAllReceivers++;
          logger.debug(
            `Message ${messageId} marked for deletion: deleted by all receivers`
          );
          continue;
        }

        // Rules 2-4: Priority-based age expiration
        if (msg.priority === "low" && msg.createdAt < ninetyDaysAgo) {
          messagesToDelete.push(messageId);
          stats.deletionsByReason.lowPriorityExpired++;
          logger.debug(
            `Message ${messageId} marked for deletion: low priority past 90 days`
          );
          continue;
        }

        if (
          msg.priority === "medium" &&
          msg.createdAt < oneHundredSixtyDaysAgo
        ) {
          messagesToDelete.push(messageId);
          stats.deletionsByReason.mediumPriorityExpired++;
          logger.debug(
            `Message ${messageId} marked for deletion: medium priority past 160 days`
          );
          continue;
        }

        if (msg.priority === "high" && msg.createdAt < twoHundredFortyDaysAgo) {
          messagesToDelete.push(messageId);
          stats.deletionsByReason.highPriorityExpired++;
          logger.debug(
            `Message ${messageId} marked for deletion: high priority past 240 days`
          );
          continue;
        }

        // Rule 5: Deleted OR seen by all receivers, and past 60 days
        if (msg.createdAt < sixtyDaysAgo) {
          const allDeletedOrSeen = userStateArray.every(
            (state: {
              isDeletedFromSystem?: boolean;
              isRemovedFromBell?: boolean;
              isReadInSystem?: boolean;
              isReadInBell?: boolean;
            }) =>
              state.isDeletedFromSystem === true ||
              state.isRemovedFromBell === true ||
              state.isReadInSystem === true ||
              state.isReadInBell === true
          );

          if (allDeletedOrSeen) {
            messagesToDelete.push(messageId);
            stats.deletionsByReason.seenAndExpired++;
            logger.debug(
              `Message ${messageId} marked for deletion: seen/deleted by all and past 60 days`
            );
            continue;
          }
        }
      }

      // Perform batch deletion
      if (messagesToDelete.length > 0) {
        const deleteResult = await Message.deleteMany({
          _id: { $in: messagesToDelete },
        });
        stats.deletedCount = deleteResult.deletedCount || 0;

        logger.info(
          `Cleanup completed: deleted ${
            stats.deletedCount
          } messages. Details: ${JSON.stringify(stats.deletionsByReason)}`
        );
      } else {
        logger.info("Cleanup completed: no messages eligible for deletion");
      }
    } catch (error) {
      logger.error(
        "Error during message cleanup",
        error instanceof Error ? error : new Error(String(error)),
        undefined,
        { stats }
      );
      throw error;
    } finally {
      stats.executionTimeMs = Date.now() - startTime;
    }

    return stats;
  }
}
