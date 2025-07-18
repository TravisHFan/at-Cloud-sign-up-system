import type { ApiResponse } from "./api";
import type { Notification } from "../types/notification";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5001/api/v1";

export interface NotificationSettings {
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
}

class NotificationService {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;

    // Get auth token from localStorage
    const token = localStorage.getItem("authToken");

    const defaultHeaders: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (token) {
      defaultHeaders.Authorization = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      credentials: "include",
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("authToken");
        }
        throw new Error(data.message || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error("Notification API Request failed:", error);
      throw error instanceof Error ? error : new Error("Network error");
    }
  }

  // Get user bell notifications (new user-centric API)
  async getNotifications(): Promise<Notification[]> {
    const response = await this.request<{ notifications: any[] }>(
      "/user/notifications/bell"
    );

    // Transform backend notifications to match frontend interface
    const notifications: Notification[] = (
      response.data?.notifications || []
    ).map((notification: any) => {
      // Map backend types to frontend types
      let frontendType: "system" | "user_message" | "management_action";
      switch (notification.type) {
        case "SYSTEM_MESSAGE":
          frontendType = "system";
          break;
        case "USER_ACTION":
          frontendType = "management_action";
          break;
        default:
          frontendType = "system"; // fallback
      }

      const transformed: Notification = {
        id: notification.id,
        type: frontendType,
        title: notification.title,
        message: notification.message,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
        userId: notification.userId,
      };

      // Add action details for management actions
      if (notification.actionType || notification.actionDetails) {
        transformed.actionType = notification.actionType;
        transformed.actionDetails = notification.actionDetails;
      }

      return transformed;
    });

    return notifications;
  }

  // Mark bell notification as read (use correct system-messages endpoint)
  async markAsRead(notificationId: string): Promise<void> {
    await this.request(
      `/system-messages/bell-notifications/${notificationId}/read`,
      {
        method: "PATCH",
      }
    );
  }

  // Mark all bell notifications as read
  async markAllAsRead(): Promise<void> {
    await this.request("/system-messages/bell-notifications/read-all", {
      method: "PATCH",
    });
  }

  // Delete a specific bell notification (use correct system-messages endpoint)
  async deleteNotification(notificationId: string): Promise<void> {
    await this.request(
      `/system-messages/bell-notifications/${notificationId}`,
      {
        method: "DELETE",
      }
    );
  }

  // Get unread counts (new user-centric API)
  async getUnreadCounts(): Promise<{
    bellNotifications: number;
    systemMessages: number;
    total: number;
  }> {
    const response = await this.request<{
      bellNotifications: number;
      systemMessages: number;
      total: number;
    }>("/user/notifications/unread-counts");
    return (
      response.data || { bellNotifications: 0, systemMessages: 0, total: 0 }
    );
  }

  // Clean up expired notifications (new user-centric API)
  async cleanupExpiredItems(): Promise<{
    removedNotifications: number;
    removedMessages: number;
  }> {
    const response = await this.request<{
      removedNotifications: number;
      removedMessages: number;
    }>("/user/notifications/cleanup", {
      method: "POST",
    });
    return response.data || { removedNotifications: 0, removedMessages: 0 };
  }

  // Get notification settings
  async getNotificationSettings(): Promise<NotificationSettings> {
    const response = await this.request<NotificationSettings>(
      "/notifications/settings"
    );
    return (
      response.data || {
        emailNotifications: true,
        smsNotifications: true,
        pushNotifications: true,
      }
    );
  }

  // Update notification settings
  async updateNotificationSettings(
    settings: Partial<NotificationSettings>
  ): Promise<NotificationSettings> {
    const response = await this.request<NotificationSettings>(
      "/notifications/settings",
      {
        method: "PUT",
        body: JSON.stringify(settings),
      }
    );
    return response.data || (settings as NotificationSettings);
  }

  // Admin: Create notification
  async createNotification(notification: {
    userId?: string;
    type: string;
    title: string;
    message: string;
    data?: any;
  }): Promise<Notification> {
    const response = await this.request<Notification>("/notifications", {
      method: "POST",
      body: JSON.stringify(notification),
    });
    return response.data!;
  }

  // Admin: Send bulk notification
  async sendBulkNotification(notification: {
    userIds?: string[];
    type: string;
    title: string;
    message: string;
    data?: any;
  }): Promise<void> {
    await this.request("/notifications/bulk", {
      method: "POST",
      body: JSON.stringify(notification),
    });
  }
}

// Create and export a singleton instance
export const notificationService = new NotificationService();
export default notificationService;
