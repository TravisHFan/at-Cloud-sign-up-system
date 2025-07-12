import type { AuthUser } from "../types";

export type ActivityType =
  | "signup" // Event registration
  | "login" // User login
  | "logout" // User logout
  | "profile_update" // Profile information changes
  | "password_change" // Password security updates
  | "event_create" // New event creation (admin)
  | "event_update" // Event modification (admin)
  | "event_delete" // Event deletion (admin)
  | "user_management" // User role/status changes (admin)
  | "chat_message" // Chat activity
  | "notification" // System notifications
  | "security_alert" // Security-related activities
  | "data_export" // Data export actions (admin)
  | "system_config"; // System configuration changes (super admin)

export interface ActivityRecord {
  id: string;
  userId: string;
  type: ActivityType;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  color: string;
  icon?: string;
  priority: "low" | "medium" | "high";
  isPublic: boolean; // Whether this activity is visible to other users
}

export interface ActivityFilters {
  userId?: string;
  types?: ActivityType[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  includePublic?: boolean;
}

class ActivityService {
  private activities: ActivityRecord[] = [];
  private listeners: Array<(activities: ActivityRecord[]) => void> = [];

  // Activity type configurations
  private activityConfig: Record<
    ActivityType,
    {
      color: string;
      icon: string;
      priority: "low" | "medium" | "high";
      isPublicByDefault: boolean;
    }
  > = {
    signup: {
      color: "bg-blue-500",
      icon: "📝",
      priority: "medium",
      isPublicByDefault: false,
    },
    login: {
      color: "bg-green-500",
      icon: "🔐",
      priority: "low",
      isPublicByDefault: false,
    },
    logout: {
      color: "bg-gray-500",
      icon: "🚪",
      priority: "low",
      isPublicByDefault: false,
    },
    profile_update: {
      color: "bg-emerald-500",
      icon: "👤",
      priority: "medium",
      isPublicByDefault: false,
    },
    password_change: {
      color: "bg-red-500",
      icon: "🔒",
      priority: "high",
      isPublicByDefault: false,
    },
    event_create: {
      color: "bg-purple-500",
      icon: "✨",
      priority: "high",
      isPublicByDefault: true,
    },
    event_update: {
      color: "bg-indigo-500",
      icon: "✏️",
      priority: "medium",
      isPublicByDefault: true,
    },
    event_delete: {
      color: "bg-red-600",
      icon: "🗑️",
      priority: "high",
      isPublicByDefault: true,
    },
    user_management: {
      color: "bg-orange-500",
      icon: "👥",
      priority: "high",
      isPublicByDefault: false,
    },
    chat_message: {
      color: "bg-cyan-500",
      icon: "💬",
      priority: "low",
      isPublicByDefault: false,
    },
    notification: {
      color: "bg-yellow-500",
      icon: "🔔",
      priority: "medium",
      isPublicByDefault: false,
    },
    security_alert: {
      color: "bg-red-700",
      icon: "⚠️",
      priority: "high",
      isPublicByDefault: false,
    },
    data_export: {
      color: "bg-teal-500",
      icon: "📊",
      priority: "medium",
      isPublicByDefault: false,
    },
    system_config: {
      color: "bg-slate-600",
      icon: "⚙️",
      priority: "high",
      isPublicByDefault: false,
    },
  };

  /**
   * Record a new activity
   */
  recordActivity(params: {
    userId: string;
    type: ActivityType;
    title: string;
    description?: string;
    metadata?: Record<string, any>;
    isPublic?: boolean;
  }): ActivityRecord {
    const config = this.activityConfig[params.type];

    const activity: ActivityRecord = {
      id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: params.userId,
      type: params.type,
      title: params.title,
      description: params.description,
      metadata: params.metadata || {},
      timestamp: new Date(),
      color: config.color,
      icon: config.icon,
      priority: config.priority,
      isPublic: params.isPublic ?? config.isPublicByDefault,
    };

    this.activities.unshift(activity); // Add to beginning for chronological order

    // Clean up activities older than 30 days
    this.cleanupOldActivities();

    // Keep only last 1000 activities to prevent memory issues
    if (this.activities.length > 1000) {
      this.activities = this.activities.slice(0, 1000);
    }

    // Notify listeners
    this.notifyListeners();

    return activity;
  }

  /**
   * Get activities based on filters
   */
  getActivities(filters: ActivityFilters = {}): ActivityRecord[] {
    // Clean up old activities before filtering
    this.cleanupOldActivities();

    let filtered = [...this.activities];

    // Filter by user ID
    if (filters.userId) {
      filtered = filtered.filter(
        (activity) =>
          activity.userId === filters.userId ||
          (filters.includePublic && activity.isPublic)
      );
    }

    // Filter by activity types
    if (filters.types && filters.types.length > 0) {
      filtered = filtered.filter((activity) =>
        filters.types!.includes(activity.type)
      );
    }

    // Filter by date range
    if (filters.startDate) {
      filtered = filtered.filter(
        (activity) => activity.timestamp >= filters.startDate!
      );
    }

    if (filters.endDate) {
      filtered = filtered.filter(
        (activity) => activity.timestamp <= filters.endDate!
      );
    }

    // Apply limit
    if (filters.limit) {
      filtered = filtered.slice(0, filters.limit);
    }

    return filtered;
  }

  /**
   * Get recent activities for a user (for dashboard display)
   */
  getRecentActivities(userId: string, limit: number = 4): ActivityRecord[] {
    return this.getActivities({
      userId,
      includePublic: true,
      limit,
    });
  }

  /**
   * Subscribe to activity updates
   */
  subscribe(callback: (activities: ActivityRecord[]) => void): () => void {
    this.listeners.push(callback);

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(
        (listener) => listener !== callback
      );
    };
  }

  /**
   * Clean up activities older than 30 days
   */
  private cleanupOldActivities(): void {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const originalLength = this.activities.length;
    this.activities = this.activities.filter(
      (activity) => activity.timestamp >= thirtyDaysAgo
    );

    // Log if activities were cleaned up (for development)
    if (originalLength !== this.activities.length) {
      console.log(
        `🧹 Cleaned up ${
          originalLength - this.activities.length
        } activities older than 30 days`
      );
    }
  }

  /**
   * Notify all listeners of activity updates
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      listener([...this.activities]);
    });
  }

  /**
   * Clear all activities (for testing/development)
   */
  clearActivities(): void {
    this.activities = [];
    this.notifyListeners();
  }

  /**
   * Initialize with mock data for development
   */
  initializeMockData(currentUser: AuthUser): void {
    // Only initialize if no activities exist
    if (this.activities.length > 0) return;

    const now = new Date();
    const hoursAgo = (hours: number) =>
      new Date(now.getTime() - hours * 60 * 60 * 1000);
    const daysAgo = (days: number) =>
      new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Recent login
    this.recordActivity({
      userId: currentUser.id,
      type: "login",
      title: "Logged in successfully",
      description: "User authenticated via web interface",
      metadata: { ip: "192.168.1.100", browser: "Chrome" },
    });

    // Event signup (2 hours ago)
    this.activities.push({
      ...this.recordActivity({
        userId: currentUser.id,
        type: "signup",
        title: "Signed up for Effective Communication Workshop",
        description: "Registered for event on March 15, 2025",
        metadata: {
          eventId: "event_123",
          eventName: "Effective Communication Workshop",
        },
      }),
      timestamp: hoursAgo(2),
    });

    // Profile update (1 day ago)
    this.activities.push({
      ...this.recordActivity({
        userId: currentUser.id,
        type: "profile_update",
        title: "Updated profile information",
        description: "Changed contact information and preferences",
        metadata: { fields: ["phone", "address", "notifications"] },
      }),
      timestamp: daysAgo(1),
    });

    // Password change (2 days ago)
    this.activities.push({
      ...this.recordActivity({
        userId: currentUser.id,
        type: "password_change",
        title: "Changed password successfully",
        description: "Security credentials updated",
        metadata: { strength: "strong" },
      }),
      timestamp: daysAgo(2),
    });

    // Event creation (for admin users, 3 days ago)
    if (["Super Admin", "Administrator", "Leader"].includes(currentUser.role)) {
      this.activities.push({
        ...this.recordActivity({
          userId: currentUser.id,
          type: "event_create",
          title: "Created new event: Bible Study Series",
          description: "New recurring event series starting next month",
          metadata: {
            eventId: "event_456",
            category: "Education",
            recurring: true,
          },
          isPublic: true,
        }),
        timestamp: daysAgo(3),
      });

      // User management activity (5 days ago)
      this.activities.push({
        ...this.recordActivity({
          userId: currentUser.id,
          type: "user_management",
          title: "Updated user roles for 3 members",
          description: "Promoted participants to leader status",
          metadata: { affectedUsers: 3, action: "role_update" },
        }),
        timestamp: daysAgo(5),
      });
    }

    // Chat activity (6 hours ago)
    this.activities.push({
      ...this.recordActivity({
        userId: currentUser.id,
        type: "chat_message",
        title: "Sent message in Youth Ministry chat",
        description: "Participated in group discussion",
        metadata: { chatId: "chat_youth", messageCount: 1 },
      }),
      timestamp: hoursAgo(6),
    });

    // Sort activities by timestamp (newest first)
    this.activities.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
    this.notifyListeners();
  }
}

// Create singleton instance
export const activityService = new ActivityService();

// Utility functions for common activity types
export const ActivityTrackers = {
  /**
   * Track user login
   */
  trackLogin: (user: AuthUser, metadata?: Record<string, any>) => {
    return activityService.recordActivity({
      userId: user.id,
      type: "login",
      title: "Logged in successfully",
      description: `${user.firstName} ${user.lastName} signed in`,
      metadata,
    });
  },

  /**
   * Track user logout
   */
  trackLogout: (user: AuthUser) => {
    return activityService.recordActivity({
      userId: user.id,
      type: "logout",
      title: "Logged out",
      description: "User session ended",
    });
  },

  /**
   * Track event signup
   */
  trackEventSignup: (user: AuthUser, eventName: string, eventId: string) => {
    return activityService.recordActivity({
      userId: user.id,
      type: "signup",
      title: `Signed up for ${eventName}`,
      description: "Registered for upcoming event",
      metadata: { eventId, eventName },
    });
  },

  /**
   * Track profile update
   */
  trackProfileUpdate: (user: AuthUser, updatedFields: string[]) => {
    return activityService.recordActivity({
      userId: user.id,
      type: "profile_update",
      title: "Updated profile information",
      description: `Modified ${updatedFields.join(", ")}`,
      metadata: { fields: updatedFields },
    });
  },

  /**
   * Track password change
   */
  trackPasswordChange: (user: AuthUser) => {
    return activityService.recordActivity({
      userId: user.id,
      type: "password_change",
      title: "Changed password successfully",
      description: "Account security updated",
      metadata: { timestamp: new Date().toISOString() },
    });
  },

  /**
   * Track event creation (admin only)
   */
  trackEventCreation: (user: AuthUser, eventName: string, eventId: string) => {
    return activityService.recordActivity({
      userId: user.id,
      type: "event_create",
      title: `Created new event: ${eventName}`,
      description: "New event available for registration",
      metadata: { eventId, eventName },
      isPublic: true,
    });
  },

  /**
   * Track chat message
   */
  trackChatMessage: (user: AuthUser, chatName: string, chatId: string) => {
    return activityService.recordActivity({
      userId: user.id,
      type: "chat_message",
      title: `Sent message in ${chatName}`,
      description: "Participated in group discussion",
      metadata: { chatId, chatName },
    });
  },
};
