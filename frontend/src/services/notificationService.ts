import type { ApiResponse } from "./api";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5001/api/v1";

export interface Notification {
  id: string;
  userId: string;
  type: "system" | "user_message" | "management_action";
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  fromUser?: {
    id: string;
    username: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
  };
  eventId?: string;
  data?: any;
}

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
    const response = await this.request<Notification[]>("/notifications");
    return response.data || [];
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
