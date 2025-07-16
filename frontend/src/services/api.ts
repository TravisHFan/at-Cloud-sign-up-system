// API Configuration
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5001/api/v1";

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
}

export interface AuthResponse {
  user: {
    id: string;
    username: string;
    email: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    gender?: string;
    role: string;
    isAtCloudLeader: boolean;
    roleInAtCloud?: string;
    avatar?: string;
    weeklyChurch?: string;
    churchAddress?: string;
    occupation?: string;
    company?: string;
    homeAddress?: string;
    lastLogin?: string;
    createdAt?: string;
    emailNotifications?: boolean;
    smsNotifications?: boolean;
    pushNotifications?: boolean;
    isVerified?: boolean;
    isActive?: boolean;
  };
  accessToken: string;
  expiresAt: string;
}

// API Client Class
class ApiClient {
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

    const defaultHeaders: HeadersInit = {};

    // Only set Content-Type for non-FormData requests
    if (!(options.body instanceof FormData)) {
      defaultHeaders["Content-Type"] = "application/json";
    }

    if (token) {
      defaultHeaders.Authorization = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      credentials: "include", // Include cookies for refresh tokens
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        // Handle 401 errors (token expired)
        if (response.status === 401) {
          localStorage.removeItem("authToken");
          // Could trigger a refresh token attempt here
        }

        throw new Error(data.message || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error("API Request failed:", error);
      throw error instanceof Error ? error : new Error("Network error");
    }
  }

  // Authentication endpoints
  async login(
    emailOrUsername: string,
    password: string,
    rememberMe?: boolean
  ): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        emailOrUsername,
        password,
        rememberMe,
      }),
    });

    if (response.data) {
      // Store token in localStorage
      localStorage.setItem("authToken", response.data.accessToken);
      return response.data;
    }

    throw new Error(response.message || "Login failed");
  }

  async register(userData: {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
    firstName?: string;
    lastName?: string;
    gender?: "male" | "female";
    isAtCloudLeader: boolean;
    roleInAtCloud?: string;
    occupation?: string;
    company?: string;
    weeklyChurch?: string;
    acceptTerms: boolean;
  }): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    });

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Registration failed");
  }

  async logout(): Promise<void> {
    try {
      await this.request("/auth/logout", {
        method: "POST",
      });
    } finally {
      localStorage.removeItem("authToken");
    }
  }

  async getProfile(): Promise<AuthResponse["user"]> {
    const response = await this.request<{ user: AuthResponse["user"] }>(
      "/auth/profile"
    );

    if (response.data) {
      return response.data.user;
    }

    throw new Error(response.message || "Failed to get profile");
  }

  async refreshToken(): Promise<AuthTokens> {
    const response = await this.request<AuthTokens>("/auth/refresh-token", {
      method: "POST",
    });

    if (response.data) {
      localStorage.setItem("authToken", response.data.accessToken);
      return response.data;
    }

    throw new Error(response.message || "Token refresh failed");
  }

  async verifyEmail(token: string): Promise<void> {
    await this.request(`/auth/verify-email/${token}`);
  }

  async resendVerification(email: string): Promise<void> {
    await this.request("/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async forgotPassword(email: string): Promise<void> {
    await this.request("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(
    token: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<void> {
    await this.request("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, newPassword, confirmPassword }),
    });
  }

  // Event endpoints
  async getEvents(params?: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    category?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }): Promise<{
    events: any[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalEvents: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const endpoint = `/events${
      queryParams.toString() ? `?${queryParams.toString()}` : ""
    }`;
    const response = await this.request<{
      events: any[];
      pagination: any;
    }>(endpoint);

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to get events");
  }

  async getEvent(id: string): Promise<any> {
    const response = await this.request<{ event: any }>(`/events/${id}`);

    if (response.data) {
      return response.data.event;
    }

    throw new Error(response.message || "Failed to get event");
  }

  async createEvent(eventData: any): Promise<any> {
    const response = await this.request<{ event: any }>("/events", {
      method: "POST",
      body: JSON.stringify(eventData),
    });

    if (response.data) {
      return response.data.event;
    }

    throw new Error(response.message || "Failed to create event");
  }

  async updateEvent(eventId: string, eventData: any): Promise<any> {
    const response = await this.request<{ event: any }>(`/events/${eventId}`, {
      method: "PUT",
      body: JSON.stringify(eventData),
    });

    if (response.data) {
      return response.data.event;
    }

    throw new Error(response.message || "Failed to update event");
  }

  async deleteEvent(eventId: string): Promise<void> {
    await this.request(`/events/${eventId}`, {
      method: "DELETE",
    });
  }

  async getEventParticipants(eventId: string): Promise<any[]> {
    const response = await this.request<{ participants: any[] }>(
      `/events/${eventId}/participants`
    );

    if (response.data) {
      return response.data.participants;
    }

    throw new Error(response.message || "Failed to get event participants");
  }

  async signUpForEvent(
    eventId: string,
    roleId: string,
    notes?: string,
    specialRequirements?: string
  ): Promise<any> {
    const response = await this.request<{ event: any }>(
      `/events/${eventId}/signup`,
      {
        method: "POST",
        body: JSON.stringify({
          roleId,
          notes,
          specialRequirements,
        }),
      }
    );

    if (response.data) {
      return response.data.event;
    }

    throw new Error(response.message || "Failed to sign up for event");
  }

  async cancelEventSignup(eventId: string, roleId: string): Promise<any> {
    const response = await this.request<{ event: any }>(
      `/events/${eventId}/cancel`,
      {
        method: "POST",
        body: JSON.stringify({ roleId }),
      }
    );

    if (response.data) {
      return response.data.event;
    }

    throw new Error(response.message || "Failed to cancel signup");
  }

  async updateEventStatuses(): Promise<{ updatedCount: number }> {
    const response = await this.request<{ updatedCount: number }>(
      "/events/update-statuses",
      {
        method: "POST",
      }
    );

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to update event statuses");
  }

  // User endpoints
  async getUserEvents(): Promise<any[]> {
    const response = await this.request<{ events: any[] }>(
      "/events/user/registered"
    );

    if (response.data) {
      return response.data.events;
    }

    throw new Error(response.message || "Failed to get user events");
  }

  async getCreatedEvents(): Promise<any[]> {
    const response = await this.request<{ events: any[] }>(
      "/events/user/created"
    );

    if (response.data) {
      return response.data.events;
    }

    throw new Error(response.message || "Failed to get created events");
  }

  // User management endpoints
  async getUsers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    isActive?: boolean;
    emailVerified?: boolean;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }): Promise<{
    users: any[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalUsers: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const endpoint = `/users${
      queryParams.toString() ? `?${queryParams.toString()}` : ""
    }`;
    const response = await this.request<{
      users: any[];
      pagination: any;
    }>(endpoint);

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to get users");
  }

  async getUser(id: string): Promise<any> {
    const response = await this.request<{ user: any }>(`/users/${id}`);

    if (response.data) {
      return response.data.user;
    }

    throw new Error(response.message || "Failed to get user");
  }

  async updateProfile(updates: any): Promise<any> {
    const response = await this.request<{ user: any }>("/users/profile", {
      method: "PUT",
      body: JSON.stringify(updates),
    });

    if (response.data) {
      return response.data.user;
    }

    throw new Error(response.message || "Failed to update profile");
  }

  async getUserStats(): Promise<any> {
    const response = await this.request<any>("/users/stats");

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to get user stats");
  }

  async updateUserRole(userId: string, role: string): Promise<any> {
    const response = await this.request<{ user: any }>(
      `/users/${userId}/role`,
      {
        method: "PUT",
        body: JSON.stringify({ role }),
      }
    );

    if (response.data) {
      return response.data.user;
    }

    throw new Error(response.message || "Failed to update user role");
  }

  async deleteUser(userId: string): Promise<void> {
    await this.request(`/users/${userId}`, {
      method: "DELETE",
    });
  }

  async changePassword(
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<void> {
    await this.request("/users/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
  }

  async deactivateUser(userId: string): Promise<void> {
    await this.request(`/users/${userId}/deactivate`, {
      method: "PUT",
    });
  }

  async reactivateUser(userId: string): Promise<void> {
    await this.request(`/users/${userId}/reactivate`, {
      method: "PUT",
    });
  }

  // File upload endpoints
  async uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
    const formData = new FormData();
    formData.append("avatar", file);

    const response = await this.request<{ avatarUrl: string }>(
      "/users/avatar",
      {
        method: "POST",
        body: formData,
      }
    );

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to upload avatar");
  }

  // Notification endpoints
  async getNotifications(): Promise<any[]> {
    const response = await this.request<{ notifications: any[] }>(
      "/notifications"
    );

    if (response.data) {
      return response.data.notifications;
    }

    throw new Error(response.message || "Failed to get notifications");
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    await this.request(`/notifications/${notificationId}/read`, {
      method: "PUT",
    });
  }

  async markAllNotificationsAsRead(): Promise<void> {
    await this.request("/notifications/mark-all-read", {
      method: "PUT",
    });
  }

  async deleteNotification(notificationId: string): Promise<void> {
    await this.request(`/notifications/${notificationId}`, {
      method: "DELETE",
    });
  }

  async clearAllNotifications(): Promise<void> {
    await this.request("/notifications", {
      method: "DELETE",
    });
  }

  async createNotification(notificationData: any): Promise<any> {
    const response = await this.request<{ notification: any }>(
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

  async sendBulkNotification(notificationData: any): Promise<number> {
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

  async getNotificationSettings(): Promise<any> {
    const response = await this.request<{ settings: any }>(
      "/notifications/settings"
    );

    if (response.data) {
      return response.data.settings;
    }

    throw new Error(response.message || "Failed to get notification settings");
  }

  async updateNotificationSettings(settings: any): Promise<any> {
    const response = await this.request<{ settings: any }>(
      "/notifications/settings",
      {
        method: "PUT",
        body: JSON.stringify(settings),
      }
    );

    if (response.data) {
      return response.data.settings;
    }

    throw new Error(
      response.message || "Failed to update notification settings"
    );
  }

  // System Message endpoints
  async getSystemMessages(): Promise<any[]> {
    const response = await this.request<{ systemMessages: any[] }>(
      "/system-messages"
    );

    if (response.data) {
      return response.data.systemMessages;
    }

    throw new Error(response.message || "Failed to get system messages");
  }

  async getSystemMessageUnreadCount(): Promise<number> {
    const response = await this.request<{ unreadCount: number }>(
      "/system-messages/unread-count"
    );

    if (response.data) {
      return response.data.unreadCount;
    }

    throw new Error(response.message || "Failed to get unread count");
  }

  async checkWelcomeMessageStatus(): Promise<boolean> {
    const response = await this.request<{ hasReceivedWelcomeMessage: boolean }>(
      "/system-messages/welcome-status"
    );

    if (response.data) {
      return response.data.hasReceivedWelcomeMessage;
    }

    throw new Error(
      response.message || "Failed to check welcome message status"
    );
  }

  async markSystemMessageAsRead(messageId: string): Promise<any> {
    const response = await this.request<any>(
      `/system-messages/${messageId}/read`,
      {
        method: "PUT",
      }
    );

    if (response.success) {
      return response;
    }

    throw new Error(response.message || "Failed to mark message as read");
  }

  async markAllSystemMessagesAsRead(): Promise<any> {
    const response = await this.request<any>("/system-messages/mark-all-read", {
      method: "PUT",
    });

    if (response.success) {
      return response;
    }

    throw new Error(response.message || "Failed to mark all messages as read");
  }

  async createSystemMessage(message: any): Promise<any> {
    const response = await this.request<any>("/system-messages", {
      method: "POST",
      body: JSON.stringify(message),
    });

    if (response.success) {
      return response;
    }

    throw new Error(response.message || "Failed to create system message");
  }

  async createAutoSystemMessage(message: any): Promise<any> {
    const response = await this.request<any>("/system-messages/auto", {
      method: "POST",
      body: JSON.stringify(message),
    });

    if (response.success) {
      return response;
    }

    throw new Error(response.message || "Failed to create auto system message");
  }

  async deleteSystemMessage(messageId: string): Promise<any> {
    const response = await this.request<any>(`/system-messages/${messageId}`, {
      method: "DELETE",
    });

    if (response.success) {
      return response;
    }

    throw new Error(response.message || "Failed to delete system message");
  }

  // Message endpoints
  async getMessages(params: {
    chatRoomId?: string;
    eventId?: string;
    receiverId?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params.chatRoomId) queryParams.append("chatRoomId", params.chatRoomId);
    if (params.eventId) queryParams.append("eventId", params.eventId);
    if (params.receiverId) queryParams.append("receiverId", params.receiverId);
    if (params.page) queryParams.append("page", params.page.toString());
    if (params.limit) queryParams.append("limit", params.limit.toString());

    const response = await this.request<any>(
      `/messages?${queryParams.toString()}`
    );

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to fetch messages");
  }

  async sendMessage(messageData: {
    content: string;
    chatRoomId?: string;
    eventId?: string;
    receiverId?: string;
    messageType?: string;
    parentMessageId?: string;
    mentions?: string[];
    priority?: string;
    tags?: string[];
  }): Promise<any> {
    const response = await this.request<any>("/messages", {
      method: "POST",
      body: JSON.stringify(messageData),
    });

    if (response.data) {
      return response.data.message;
    }

    throw new Error(response.message || "Failed to send message");
  }

  async editMessage(messageId: string, content: string): Promise<any> {
    const response = await this.request<any>(`/messages/${messageId}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    });

    if (response.data) {
      return response.data.message;
    }

    throw new Error(response.message || "Failed to edit message");
  }

  async deleteMessage(messageId: string): Promise<boolean> {
    const response = await this.request<any>(`/messages/${messageId}`, {
      method: "DELETE",
    });

    return response.success;
  }

  async addReaction(messageId: string, emoji: string): Promise<any> {
    const response = await this.request<any>(
      `/messages/${messageId}/reactions`,
      {
        method: "POST",
        body: JSON.stringify({ emoji }),
      }
    );

    if (response.data) {
      return response.data.message;
    }

    throw new Error(response.message || "Failed to add reaction");
  }

  async getChatRooms(): Promise<any[]> {
    const response = await this.request<any>("/messages/chat-rooms");

    if (response.data) {
      return response.data.chatRooms;
    }

    throw new Error(response.message || "Failed to fetch chat rooms");
  }

  async createChatRoom(chatRoomData: {
    name: string;
    description?: string;
    type?: string;
    isPrivate?: boolean;
    eventId?: string;
    participantIds?: string[];
  }): Promise<any> {
    const response = await this.request<any>("/messages/chat-rooms", {
      method: "POST",
      body: JSON.stringify(chatRoomData),
    });

    if (response.data) {
      return response.data.chatRoom;
    }

    throw new Error(response.message || "Failed to create chat room");
  }

  // Analytics endpoints
  async getAnalytics(): Promise<any> {
    const response = await this.request<any>("/analytics");

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to get analytics");
  }

  async getUserAnalytics(): Promise<any> {
    const response = await this.request<any>("/analytics/users");

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to get user analytics");
  }

  async getEventAnalytics(): Promise<any> {
    const response = await this.request<any>("/analytics/events");

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to get event analytics");
  }

  async getEngagementAnalytics(): Promise<any> {
    const response = await this.request<any>("/analytics/engagement");

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to get engagement analytics");
  }

  async exportAnalytics(
    format: "csv" | "xlsx" | "json" = "csv"
  ): Promise<Blob> {
    const response = await fetch(
      `${this.baseURL}/analytics/export?format=${format}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to export analytics");
    }

    return response.blob();
  }

  // Performance endpoints
  async getSystemMetrics(): Promise<any> {
    const response = await this.request<any>("/performance/metrics/system");

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to get system metrics");
  }

  async getApiMetrics(): Promise<any> {
    const response = await this.request<any>("/performance/metrics/api");

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to get API metrics");
  }

  async getHealthStatus(): Promise<any> {
    const response = await this.request<any>("/performance/health");

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to get health status");
  }

  // Search endpoints
  async searchUsers(query: string, filters?: any): Promise<any> {
    const queryParams = new URLSearchParams({ q: query });
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const response = await this.request<any>(
      `/search/users?${queryParams.toString()}`
    );

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to search users");
  }

  async searchEvents(query: string, filters?: any): Promise<any> {
    const queryParams = new URLSearchParams({ q: query });
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const response = await this.request<any>(
      `/search/events?${queryParams.toString()}`
    );

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to search events");
  }

  async globalSearch(query: string): Promise<any> {
    const response = await this.request<any>(
      `/search/global?q=${encodeURIComponent(query)}`
    );

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to perform global search");
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export individual service functions for convenience
export const authService = {
  login: (emailOrUsername: string, password: string, rememberMe?: boolean) =>
    apiClient.login(emailOrUsername, password, rememberMe),
  register: (userData: Parameters<typeof apiClient.register>[0]) =>
    apiClient.register(userData),
  logout: () => apiClient.logout(),
  getProfile: () => apiClient.getProfile(),
  refreshToken: () => apiClient.refreshToken(),
  verifyEmail: (token: string) => apiClient.verifyEmail(token),
  resendVerification: (email: string) => apiClient.resendVerification(email),
  forgotPassword: (email: string) => apiClient.forgotPassword(email),
  resetPassword: (
    token: string,
    newPassword: string,
    confirmPassword: string
  ) => apiClient.resetPassword(token, newPassword, confirmPassword),
};

export const eventService = {
  getEvents: (params?: Parameters<typeof apiClient.getEvents>[0]) =>
    apiClient.getEvents(params),
  getEvent: (id: string) => apiClient.getEvent(id),
  createEvent: (eventData: any) => apiClient.createEvent(eventData),
  updateEvent: (eventId: string, eventData: any) =>
    apiClient.updateEvent(eventId, eventData),
  deleteEvent: (eventId: string) => apiClient.deleteEvent(eventId),
  getEventParticipants: (eventId: string) =>
    apiClient.getEventParticipants(eventId),
  signUpForEvent: (
    eventId: string,
    roleId: string,
    notes?: string,
    specialRequirements?: string
  ) => apiClient.signUpForEvent(eventId, roleId, notes, specialRequirements),
  cancelSignup: (eventId: string, roleId: string) =>
    apiClient.cancelEventSignup(eventId, roleId),
  updateEventStatuses: () => apiClient.updateEventStatuses(),
  getUserEvents: () => apiClient.getUserEvents(),
  getCreatedEvents: () => apiClient.getCreatedEvents(),
};

export const userService = {
  getProfile: () => apiClient.getProfile(),
  updateProfile: (updates: any) => apiClient.updateProfile(updates),
  getUsers: (params?: Parameters<typeof apiClient.getUsers>[0]) =>
    apiClient.getUsers(params),
  getUser: (id: string) => apiClient.getUser(id),
  getUserStats: () => apiClient.getUserStats(),
  updateUserRole: (userId: string, role: string) =>
    apiClient.updateUserRole(userId, role),
  deleteUser: (userId: string) => apiClient.deleteUser(userId),
  changePassword: (
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ) => apiClient.changePassword(currentPassword, newPassword, confirmPassword),
  deactivateUser: (userId: string) => apiClient.deactivateUser(userId),
  reactivateUser: (userId: string) => apiClient.reactivateUser(userId),
};

export const notificationService = {
  getNotifications: () => apiClient.getNotifications(),
  markAsRead: (notificationId: string) =>
    apiClient.markNotificationAsRead(notificationId),
  markAllAsRead: () => apiClient.markAllNotificationsAsRead(),
  deleteNotification: (notificationId: string) =>
    apiClient.deleteNotification(notificationId),
  clearAll: () => apiClient.clearAllNotifications(),
  createNotification: (data: any) => apiClient.createNotification(data),
  sendBulkNotification: (data: any) => apiClient.sendBulkNotification(data),
  getSettings: () => apiClient.getNotificationSettings(),
  updateSettings: (settings: any) =>
    apiClient.updateNotificationSettings(settings),
};

export const messageService = {
  getMessages: (params: any) => apiClient.getMessages(params),
  sendMessage: (messageData: any) => apiClient.sendMessage(messageData),
  editMessage: (messageId: string, content: string) =>
    apiClient.editMessage(messageId, content),
  deleteMessage: (messageId: string) => apiClient.deleteMessage(messageId),
  addReaction: (messageId: string, emoji: string) =>
    apiClient.addReaction(messageId, emoji),
  getChatRooms: () => apiClient.getChatRooms(),
  createChatRoom: (chatRoomData: any) => apiClient.createChatRoom(chatRoomData),
};

export const fileService = {
  uploadAvatar: (file: File) => apiClient.uploadAvatar(file),
};

export const analyticsService = {
  getAnalytics: () => apiClient.getAnalytics(),
  getUserAnalytics: () => apiClient.getUserAnalytics(),
  getEventAnalytics: () => apiClient.getEventAnalytics(),
  getEngagementAnalytics: () => apiClient.getEngagementAnalytics(),
  exportAnalytics: (format?: "csv" | "xlsx" | "json") =>
    apiClient.exportAnalytics(format),
};

export const performanceService = {
  getSystemMetrics: () => apiClient.getSystemMetrics(),
  getApiMetrics: () => apiClient.getApiMetrics(),
  getHealthStatus: () => apiClient.getHealthStatus(),
};

export const searchService = {
  searchUsers: (query: string, filters?: any) =>
    apiClient.searchUsers(query, filters),
  searchEvents: (query: string, filters?: any) =>
    apiClient.searchEvents(query, filters),
  globalSearch: (query: string) => apiClient.globalSearch(query),
};

export const systemMessageService = {
  getSystemMessages: () => apiClient.getSystemMessages(),
  getUnreadCount: () => apiClient.getSystemMessageUnreadCount(),
  checkWelcomeMessageStatus: () => apiClient.checkWelcomeMessageStatus(),
  markAsRead: (messageId: string) =>
    apiClient.markSystemMessageAsRead(messageId),
  markAllAsRead: () => apiClient.markAllSystemMessagesAsRead(),
  createSystemMessage: (message: any) => apiClient.createSystemMessage(message),
  createAutoSystemMessage: (message: any) =>
    apiClient.createAutoSystemMessage(message),
  deleteSystemMessage: (messageId: string) =>
    apiClient.deleteSystemMessage(messageId),
};

export default apiClient;
