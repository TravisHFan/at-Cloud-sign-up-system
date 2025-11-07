import { Request, Response } from "express";
import type { IMessage } from "../models/Message";

/**
 * Unified Message Controller
 *
 * This controller replaces the previous dual system with a unified approach:
 * - Single Message model handles both system messages and bell notifications
 * - Maintains the same user experience and API endpoints
 * - Simplifies state management and eliminates synchronization issues
 *
 * User Experience Features:
 * - Bell Notifications: Quick dismissible notifications in dropdown
 * - System Messages: Full message management page
 * - Unified state: Reading in either place affects both appropriately
 */

export class UnifiedMessageController {
  // ============================================
  // SYSTEM MESSAGES API (for System Messages Page)
  // ============================================

  /**
   * Get system messages for current user
   * Used by: System Messages page (/dashboard/system-messages)
   */
  static async getSystemMessages(req: Request, res: Response): Promise<void> {
    const { default: SystemMessagesRetrievalController } = await import(
      "./message/SystemMessagesRetrievalController"
    );
    return SystemMessagesRetrievalController.getSystemMessages(req, res);
  }

  /**
   * Create new system message (Admin only)
   * Automatically creates bell notifications for all users
   */
  static async createSystemMessage(req: Request, res: Response): Promise<void> {
    const { default: SystemMessagesCreationController } = await import(
      "./message/SystemMessagesCreationController"
    );
    return SystemMessagesCreationController.createSystemMessage(req, res);
  }

  /**
   * Mark system message as read
   * Also marks corresponding bell notification as read for consistency
   */
  static async markSystemMessageAsRead(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: SystemMessagesReadController } = await import(
      "./message/SystemMessagesReadController"
    );
    return SystemMessagesReadController.markSystemMessageAsRead(req, res);
  }

  /**
   * Delete system message for current user
   * Removes from system messages but keeps in bell notifications unless already removed
   */
  static async deleteSystemMessage(req: Request, res: Response): Promise<void> {
    const { default: SystemMessagesDeletionController } = await import(
      "./message/SystemMessagesDeletionController"
    );
    return SystemMessagesDeletionController.deleteSystemMessage(req, res);
  }

  // ============================================
  // BELL NOTIFICATIONS API (for Bell Dropdown)
  // ============================================

  /**
   * Get bell notifications for current user
   * Used by: Bell notification dropdown
   */
  static async getBellNotifications(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: BellNotificationsRetrievalController } = await import(
      "./message/BellNotificationsRetrievalController"
    );
    return BellNotificationsRetrievalController.getBellNotifications(req, res);
  }

  /**
   * Mark bell notification as read
   * Also marks corresponding system message as read for consistency
   */
  static async markBellNotificationAsRead(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: BellNotificationsReadController } = await import(
      "./message/BellNotificationsReadController"
    );
    return BellNotificationsReadController.markBellNotificationAsRead(req, res);
  }

  /**
   * Mark all bell notifications as read
   */

  static async markAllBellNotificationsAsRead(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: BellNotificationsBulkReadController } = await import(
      "./message/BellNotificationsBulkReadController"
    );
    return BellNotificationsBulkReadController.markAllBellNotificationsAsRead(
      req,
      res
    );
  }

  /**
   * Remove bell notification
   * Hides from bell dropdown but keeps in system messages
   */
  static async removeBellNotification(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: BellNotificationsRemovalController } = await import(
      "./message/BellNotificationsRemovalController"
    );
    return BellNotificationsRemovalController.removeBellNotification(req, res);
  }

  // ============================================
  // UTILITY ENDPOINTS
  // ============================================

  /**
   * Get unread counts for both bell notifications and system messages
   */
  static async getUnreadCounts(req: Request, res: Response): Promise<void> {
    const { default: UnreadCountsController } = await import(
      "./message/UnreadCountsController"
    );
    return UnreadCountsController.getUnreadCounts(req, res);
  }

  /**
   * Clean up expired messages
   */
  static async cleanupExpiredMessages(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: MessageCleanupController } = await import(
      "./message/MessageCleanupController"
    );
    return MessageCleanupController.cleanupExpiredMessages(req, res);
  }

  /**
   * Welcome message status check (for onboarding)
   */
  static async checkWelcomeMessageStatus(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: WelcomeMessageStatusController } = await import(
      "./message/WelcomeMessageStatusController"
    );
    return WelcomeMessageStatusController.checkWelcomeMessageStatus(req, res);
  }

  /**
   * Send welcome notification to new user (first login)
   */
  static async sendWelcomeNotification(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: WelcomeNotificationController } = await import(
      "./message/WelcomeNotificationController"
    );
    return WelcomeNotificationController.sendWelcomeNotification(req, res);
  }

  /**
   * Create targeted system message for specific users
   * Used for: Co-organizer assignments, role-specific notifications
   */
  static async createTargetedSystemMessage(
    messageData: {
      title: string;
      content: string;
      type?: string;
      priority?: string;
      hideCreator?: boolean;
      metadata?: Record<string, unknown>;
    },
    targetUserIds: string[],
    creator?: {
      id: string;
      firstName: string;
      lastName: string;
      username: string;
      avatar?: string;
      gender: string;
      authLevel: string;
      roleInAtCloud?: string;
    }
  ): Promise<IMessage> {
    const { default: TargetedSystemMessagesController } = await import(
      "./message/TargetedSystemMessagesController"
    );
    return TargetedSystemMessagesController.createTargetedSystemMessage(
      messageData,
      targetUserIds,
      creator
    );
  }

  /**
   * Mark system message as read
   */
  static async markAsRead(req: Request, res: Response): Promise<void> {
    const { default: LegacyMessageReadController } = await import(
      "./message/LegacyMessageReadController"
    );
    return LegacyMessageReadController.markAsRead(req, res);
  }

  /**
   * Delete system message for user (soft delete)
   */
  static async deleteMessage(req: Request, res: Response): Promise<void> {
    const { default: LegacyMessageDeletionController } = await import(
      "./message/LegacyMessageDeletionController"
    );
    return LegacyMessageDeletionController.deleteMessage(req, res);
  }

  /**
   * Clean up expired messages
   */
  static async cleanupExpiredItems(req: Request, res: Response): Promise<void> {
    const { default: LegacyMessageCleanupController } = await import(
      "./message/LegacyMessageCleanupController"
    );
    return LegacyMessageCleanupController.cleanupExpiredItems(req, res);
  }
}
