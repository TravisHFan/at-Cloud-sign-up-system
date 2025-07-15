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

  // Get user notifications
  async getNotifications(): Promise<Notification[]> {
    const response = await this.request<{ notifications: any[] }>(
      "/notifications"
    );

    // Transform backend notifications to match frontend interface
    const notifications: Notification[] = (
      response.data?.notifications || []
    ).map((notification: any) => {
      let type: "system" | "user_message" | "management_action" = "system";

      if (notification.category === "system") {
        type = "system";
      } else if (notification.category === "registration") {
        type = "management_action";
      } else {
        type = "user_message";
      }

      const transformed: Notification = {
        id: notification.id || notification._id,
        type,
        title: notification.title,
        message: notification.message,
        isRead: notification.status === "read",
        createdAt: notification.createdAt,
      };

      // Add fromUser if available and properly structured
      if (notification.data?.fromUser && notification.data.fromUser.gender) {
        transformed.fromUser = {
          id: notification.data.fromUser.id,
          firstName: notification.data.fromUser.firstName || "",
          lastName: notification.data.fromUser.lastName || "",
          username: notification.data.fromUser.username,
          avatar: notification.data.fromUser.avatar,
          gender: notification.data.fromUser.gender,
        };
      }

      // Add action details for management actions
      if (type === "management_action" && notification.data) {
        transformed.actionType = notification.data.actionType;
        transformed.actionDetails = notification.data.actionDetails;
      }

      return transformed;
    });

    return notifications;
  }

  // Mark notification as read
  async markAsRead(notificationId: string): Promise<void> {
    await this.request(`/notifications/${notificationId}/read`, {
      method: "PUT",
    });
  }

  // Mark all notifications as read
  async markAllAsRead(): Promise<void> {
    await this.request("/notifications/mark-all-read", {
      method: "PUT",
    });
  }

  // Delete a specific notification
  async deleteNotification(notificationId: string): Promise<void> {
    await this.request(`/notifications/${notificationId}`, {
      method: "DELETE",
    });
  }

  // Clear all notifications
  async clearAllNotifications(): Promise<void> {
    await this.request("/notifications", {
      method: "DELETE",
    });
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
