import { BaseApiClient } from "./common";
import type { Notification } from "../../types/notification";

/**
 * Notifications API Service
 * Handles bell notifications (not system messages)
 */
class NotificationsApiClient extends BaseApiClient {
  /**
   * Get all notifications for current user
   * @returns Array of notifications
   */
  async getNotifications(): Promise<Notification[]> {
    const response = await this.request<{ notifications: Notification[] }>(
      "/notifications"
    );

    if (response.data) {
      return response.data.notifications;
    }

    throw new Error(response.message || "Failed to get notifications");
  }

  /**
   * Mark a single notification as read
   * @param notificationId - Notification ID to mark as read
   */
  async markNotificationAsRead(notificationId: string): Promise<void> {
    await this.request(`/notifications/${notificationId}/read`, {
      method: "PUT",
    });
  }

  /**
   * Mark all bell notifications as read
   * Note: This only marks BELL notifications; system messages are independent
   */
  async markAllNotificationsAsRead(): Promise<void> {
    // Deprecated legacy endpoint replaced with bell-only endpoint
    // Only mark BELL notifications as read; system messages are independent
    await this.request("/notifications/bell/read-all", {
      method: "PATCH",
    });
  }

  /**
   * Delete a single notification
   * @param notificationId - Notification ID to delete
   */
  async deleteNotification(notificationId: string): Promise<void> {
    await this.request(`/notifications/${notificationId}`, {
      method: "DELETE",
    });
  }

  /**
   * Clear all notifications for current user
   */
  async clearAllNotifications(): Promise<void> {
    await this.request("/notifications", {
      method: "DELETE",
    });
  }

  /**
   * Create a new notification (Admin only)
   * @param notificationData - Notification data
   * @returns Created notification
   */
  async createNotification(notificationData: unknown): Promise<Notification> {
    const response = await this.request<{ notification: Notification }>(
      "/notifications",
      {
        method: "POST",
        body: JSON.stringify(notificationData),
      }
    );

    if (response.data) {
      return response.data.notification;
    }

    throw new Error(response.message || "Failed to create notification");
  }

  /**
   * Send bulk notifications to multiple users (Admin only)
   * @param notificationData - Bulk notification data
   * @returns Number of notifications sent
   */
  async sendBulkNotification(notificationData: unknown): Promise<number> {
    const response = await this.request<{ count: number }>(
      "/notifications/bulk",
      {
        method: "POST",
        body: JSON.stringify(notificationData),
      }
    );

    if (response.data) {
      return response.data.count;
    }

    throw new Error(response.message || "Failed to send bulk notification");
  }
}

// Export singleton instance
const notificationsApiClient = new NotificationsApiClient();

// Export service methods
export const notificationsService = {
  getNotifications: () => notificationsApiClient.getNotifications(),
  markNotificationAsRead: (notificationId: string) =>
    notificationsApiClient.markNotificationAsRead(notificationId),
  markAllNotificationsAsRead: () =>
    notificationsApiClient.markAllNotificationsAsRead(),
  deleteNotification: (notificationId: string) =>
    notificationsApiClient.deleteNotification(notificationId),
  clearAllNotifications: () => notificationsApiClient.clearAllNotifications(),
  createNotification: (notificationData: unknown) =>
    notificationsApiClient.createNotification(notificationData),
  sendBulkNotification: (notificationData: unknown) =>
    notificationsApiClient.sendBulkNotification(notificationData),
};

// Legacy export (singular name for backward compatibility)
export const notificationService = notificationsService;
