/**
 * TRIO NOTIFICATION SERVICE - Phase 2 Enhanced Architecture
 *
 * ⚠️  CORE SERVICE - DO NOT DELETE ⚠️
 *
 * Unified service for atomic trio notification creation with advanced features:
 * - Transaction-like behavior with rollback mechanisms
 * - Centralized error handling with recovery strategies
 * - Performance optimization and monitoring
 * - Configuration-driven timeouts and retries
 *
 * PURPOSE: Single point of control for all trio operations
 * SCOPE: Email + System Message + Bell notification coordination
 * FEATURES: Atomic operations, rollback, monitoring, configuration management
 */

import { UnifiedMessageController } from "../../controllers/unifiedMessageController";
import { EmailService } from "../infrastructure/emailService";
import { socketService } from "../infrastructure/SocketService";
import { NOTIFICATION_CONFIG } from "../../config/notificationConfig";
import { NotificationErrorHandler } from "./NotificationErrorHandler";
import { TrioTransaction } from "./TrioTransaction";

// Types for trio operations
export interface TrioRequest {
  email?: {
    to: string;
    template: string;
    data: any;
    priority?: "high" | "medium" | "low";
  };
  systemMessage: {
    title: string;
    content: string;
    type?: string;
    priority?: string;
    hideCreator?: boolean;
  };
  recipients: string[]; // User IDs to receive the trio
  creator?: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    avatar?: string;
    gender: string;
    authLevel: string;
    roleInAtCloud?: string;
  };
  options?: {
    enableRollback?: boolean;
    timeout?: number;
    retries?: number;
  };
}

export interface TrioResult {
  success: boolean;
  emailId?: string;
  messageId?: string;
  notificationsSent?: number;
  error?: string;
  rollbackCompleted?: boolean;
  metrics?: {
    duration: number;
    emailTime?: number;
    messageTime?: number;
    socketTime?: number;
  };
}

export interface TrioMetrics {
  totalRequests: number;
  successfulTrios: number;
  failedTrios: number;
  averageLatency: number;
  rollbackCount: number;
  errorsByType: Record<string, number>;
}

/**
 * Enhanced Trio Notification Service
 * Replaces ad-hoc trio creation with standardized, atomic operations
 */
export class TrioNotificationService {
  private static metrics: TrioMetrics = {
    totalRequests: 0,
    successfulTrios: 0,
    failedTrios: 0,
    averageLatency: 0,
    rollbackCount: 0,
    errorsByType: {},
  };

  /**
   * Create complete notification trio with transaction safety
   * This is the main entry point for all trio operations
   */
  static async createTrio(request: TrioRequest): Promise<TrioResult> {
    const startTime = Date.now();
    const transaction = new TrioTransaction();
    this.metrics.totalRequests++;

    try {
      console.log(
        `🔄 Starting trio creation for ${request.recipients.length} recipients`
      );

      // Step 1: Send email (if provided) with timeout and retry
      let emailResult: any = null;
      let emailTime = 0;

      if (request.email) {
        const emailStart = Date.now();
        emailResult = await this.sendEmailWithTimeout(
          request.email,
          transaction
        );
        emailTime = Date.now() - emailStart;
        console.log(`📧 Email sent in ${emailTime}ms`);
      }

      // Step 2: Create system message (atomic database operation)
      const messageStart = Date.now();
      const messageResult = await this.createSystemMessage(
        request.systemMessage,
        request.recipients,
        request.creator,
        transaction
      );
      const messageTime = Date.now() - messageStart;
      console.log(`💬 System message created in ${messageTime}ms`);

      // Step 3: Emit WebSocket events (with retry and error tolerance)
      const socketStart = Date.now();
      const socketResult = await this.emitWebSocketEvents(
        messageResult,
        request.recipients,
        transaction
      );
      const socketTime = Date.now() - socketStart;
      console.log(`🔔 WebSocket events emitted in ${socketTime}ms`);

      // Commit transaction if everything succeeded
      await transaction.commit();

      const totalDuration = Date.now() - startTime;
      this.updateMetrics(true, totalDuration);

      console.log(
        `✅ Trio creation completed successfully in ${totalDuration}ms`
      );

      return {
        success: true,
        emailId: emailResult?.id,
        messageId: messageResult._id.toString(),
        notificationsSent: socketResult.count,
        metrics: {
          duration: totalDuration,
          emailTime,
          messageTime,
          socketTime,
        },
      };
    } catch (error) {
      console.error(`❌ Trio creation failed:`, error);

      // Attempt rollback if enabled
      let rollbackCompleted = false;
      if (
        request.options?.enableRollback !== false &&
        NOTIFICATION_CONFIG.features.enableRollback
      ) {
        try {
          await transaction.rollback();
          rollbackCompleted = true;
          this.metrics.rollbackCount++;
          console.log(`🔄 Rollback completed successfully`);
        } catch (rollbackError) {
          console.error(`💥 Rollback failed:`, rollbackError);
        }
      }

      // Handle error through centralized error handler
      const recoveryResult = await NotificationErrorHandler.handleTrioFailure(
        error as any,
        { request, transaction }
      );

      const totalDuration = Date.now() - startTime;
      this.updateMetrics(false, totalDuration);
      this.recordError(error);

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        rollbackCompleted,
        metrics: {
          duration: totalDuration,
        },
      };
    }
  }

  /**
   * Send email with timeout and retry logic
   */
  private static async sendEmailWithTimeout(
    emailRequest: TrioRequest["email"],
    transaction: TrioTransaction
  ): Promise<any> {
    if (!emailRequest) return null;

    const timeout = NOTIFICATION_CONFIG.timeouts.email;
    const retries = NOTIFICATION_CONFIG.retries.email;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const emailPromise = this.executeEmailSend(emailRequest);

        const emailResult = await Promise.race([
          emailPromise,
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error(`Email timeout after ${timeout}ms`)),
              timeout
            )
          ),
        ]);

        // Track email operation for rollback
        transaction.addOperation("email", {
          id: (emailResult as any)?.id,
          rollback: async () => {
            console.log(`🔄 Email rollback - marking as cancelled`);
            // Note: Most email services don't support message recall
            // but we can mark it as cancelled in our tracking
          },
        });

        return emailResult;
      } catch (error) {
        console.warn(`📧 Email attempt ${attempt}/${retries} failed:`, error);

        if (attempt === retries) {
          throw new Error(`Email failed after ${retries} attempts: ${error}`);
        }

        // Wait before retry (exponential backoff)
        // Use shorter delays in test environment to prevent timeouts
        const baseDelay = process.env.NODE_ENV === "test" ? 100 : 1000;
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * baseDelay)
        );
      }
    }
  }

  /**
   * Execute the actual email sending based on template type
   */
  private static async executeEmailSend(
    emailRequest: TrioRequest["email"]
  ): Promise<any> {
    if (!emailRequest) return null;

    switch (emailRequest.template) {
      case "welcome":
        return await EmailService.sendWelcomeEmail(
          emailRequest.to,
          emailRequest.data.name
        );

      case "password-reset-success":
        return await EmailService.sendPasswordResetSuccessEmail(
          emailRequest.to,
          emailRequest.data.name
        );

      case "event-created":
        return await EmailService.sendEventCreatedEmail(
          emailRequest.to,
          emailRequest.data.userName,
          emailRequest.data.event
        );

      case "co-organizer-assigned":
        return await EmailService.sendCoOrganizerAssignedEmail(
          emailRequest.to,
          emailRequest.data.assignedUser,
          emailRequest.data.event,
          emailRequest.data.assignedBy
        );

      case "event-reminder":
        return await EmailService.sendEventReminderEmail(
          emailRequest.data.event,
          emailRequest.data.user,
          emailRequest.data.reminderType || "upcoming",
          emailRequest.data.timeUntilEvent || "24 hours"
        );

      case "new-leader-signup":
        return await EmailService.sendNewLeaderSignupEmail(
          emailRequest.data.newUser,
          emailRequest.data.adminEmail,
          emailRequest.data.adminUsers
        );

      default:
        throw new Error(`Unknown email template: ${emailRequest.template}`);
    }
  }

  /**
   * Create system message with atomic database operation
   */
  private static async createSystemMessage(
    messageData: TrioRequest["systemMessage"],
    recipients: string[],
    creator: TrioRequest["creator"],
    transaction: TrioTransaction
  ): Promise<any> {
    try {
      const messageResult =
        await UnifiedMessageController.createTargetedSystemMessage(
          messageData,
          recipients,
          creator
        );

      // Track message operation for rollback
      transaction.addOperation("message", {
        id: messageResult._id.toString(),
        rollback: async () => {
          console.log(`🔄 Message rollback - marking as inactive`);
          // Mark message as inactive rather than deleting for audit trail
          messageResult.isActive = false;
          await messageResult.save();
        },
      });

      return messageResult;
    } catch (error) {
      throw new Error(`System message creation failed: ${error}`);
    }
  }

  /**
   * Emit WebSocket events with retry logic
   */
  private static async emitWebSocketEvents(
    message: any,
    recipients: string[],
    transaction: TrioTransaction
  ): Promise<{ count: number }> {
    let successCount = 0;
    const errors: string[] = [];

    for (const userId of recipients) {
      try {
        // Emit with retry logic
        await this.emitWithRetry(userId, message);
        successCount++;
      } catch (error) {
        console.warn(`🔔 WebSocket emission failed for user ${userId}:`, error);
        errors.push(`User ${userId}: ${error}`);

        // WebSocket failures are non-critical, continue with other users
        // but track for monitoring
      }
    }

    // Track WebSocket operations (no rollback needed as they're ephemeral)
    transaction.addOperation("websocket", {
      id: `ws-${Date.now()}`,
      metadata: { count: successCount },
      rollback: async () => {
        console.log(`🔄 WebSocket rollback - no action needed (ephemeral)`);
      },
    });

    if (successCount === 0 && recipients.length > 0) {
      throw new Error(`All WebSocket emissions failed: ${errors.join(", ")}`);
    }

    return { count: successCount };
  }

  /**
   * Emit WebSocket event with retry logic
   */
  private static async emitWithRetry(
    userId: string,
    message: any
  ): Promise<void> {
    const retries = NOTIFICATION_CONFIG.retries.websocket;
    const timeout = NOTIFICATION_CONFIG.timeouts.websocket;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const emitPromise = new Promise<void>((resolve, reject) => {
          try {
            socketService.emitSystemMessageUpdate(userId, "message_created", {
              message: message.toJSON(),
            });
            resolve();
          } catch (error) {
            reject(error);
          }
        });

        await Promise.race([
          emitPromise,
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error(`WebSocket timeout after ${timeout}ms`)),
              timeout
            )
          ),
        ]);

        return; // Success, exit retry loop
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }

        // Brief wait before retry
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
  }

  /**
   * Update performance metrics
   */
  private static updateMetrics(success: boolean, duration: number): void {
    if (success) {
      this.metrics.successfulTrios++;
    } else {
      this.metrics.failedTrios++;
    }

    // Update average latency
    const totalTrios = this.metrics.successfulTrios + this.metrics.failedTrios;
    this.metrics.averageLatency =
      (this.metrics.averageLatency * (totalTrios - 1) + duration) / totalTrios;
  }

  /**
   * Record error for metrics
   */
  private static recordError(error: any): void {
    const errorType = error.constructor.name || "UnknownError";
    this.metrics.errorsByType[errorType] =
      (this.metrics.errorsByType[errorType] || 0) + 1;
  }

  /**
   * Get current performance metrics
   */
  static getMetrics(): TrioMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics (useful for testing)
   */
  static resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulTrios: 0,
      failedTrios: 0,
      averageLatency: 0,
      rollbackCount: 0,
      errorsByType: {},
    };
  }

  // Convenience methods for common trio patterns

  /**
   * Create welcome trio (email verification success)
   */
  static async createWelcomeTrio(
    userEmail: string,
    userName: string,
    userId: string
  ): Promise<TrioResult> {
    return this.createTrio({
      email: {
        to: userEmail,
        template: "welcome",
        data: { name: userName },
        priority: "high",
      },
      systemMessage: {
        title: "Welcome to @Cloud!",
        content:
          "Welcome to the @Cloud Event Sign-up System! Your account has been verified and you can now participate in events.",
        type: "announcement",
        priority: "medium",
        hideCreator: true,
      },
      recipients: [userId],
    });
  }

  /**
   * Create password reset success trio
   */
  static async createPasswordResetSuccessTrio(
    userEmail: string,
    userName: string,
    userId: string
  ): Promise<TrioResult> {
    return this.createTrio({
      email: {
        to: userEmail,
        template: "password-reset-success",
        data: { name: userName },
        priority: "high",
      },
      systemMessage: {
        title: "Password Reset Successful",
        content:
          "Your password has been successfully reset. You can now log in with your new password.",
        type: "update",
        priority: "high",
        // Policy: senderless system message
        hideCreator: true,
      },
      recipients: [userId],
    });
  }

  /**
   * Create event reminder trio
   */
  static async createEventReminderTrio(
    event: any,
    user: any
  ): Promise<TrioResult> {
    return this.createTrio({
      email: {
        to: user.email,
        template: "event-reminder",
        data: { event, user },
        priority: "medium",
      },
      systemMessage: {
        title: "Event Reminder",
        content: `Reminder: "${event.title}" is coming up soon. Don't forget to prepare!`,
        type: "announcement",
        priority: "medium",
        // Policy: senderless system message
        hideCreator: true,
      },
      recipients: [user._id.toString()],
    });
  }
}
