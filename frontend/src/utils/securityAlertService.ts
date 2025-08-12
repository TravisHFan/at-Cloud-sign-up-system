// Security alert service for handling suspicious login activities
// Integrates with email notifications

import {
  securityMonitoring,
  generateSecurityAlertMessage,
} from "./securityMonitoring";
import type { SuspiciousActivity } from "./securityMonitoring";

export interface SecurityAlertConfig {
  enableEmailAlerts: boolean;
  enableSystemMessages: boolean;
  alertThresholds: {
    multipleIPs: number;
    rapidAttempts: number;
    unusualLocations: number;
  };
}

class SecurityAlertService {
  private config: SecurityAlertConfig = {
    enableEmailAlerts: true,
    enableSystemMessages: true,
    alertThresholds: {
      multipleIPs: 3,
      rapidAttempts: 5,
      unusualLocations: 2,
    },
  };

  private notificationContext: any = null;

  // Set the notification context for creating system messages
  setNotificationContext(notificationContext: any) {
    this.notificationContext = notificationContext;
  }

  // Main method to process security alerts
  async processSecurityAlerts(): Promise<void> {
    const suspiciousActivities =
      securityMonitoring.getRecentSuspiciousActivities();

    if (suspiciousActivities.length === 0) {
      return;
    }

    for (const activity of suspiciousActivities) {
      await this.handleSuspiciousActivity(activity);
    }
  }

  // Handle individual suspicious activity
  private async handleSuspiciousActivity(
    activity: SuspiciousActivity
  ): Promise<void> {
    const alertMessage = generateSecurityAlertMessage(activity);

    // Create system message for all users or affected users
    if (this.config.enableSystemMessages && this.notificationContext) {
      await this.createSystemMessage(activity, alertMessage);
    }

    // Send email alerts to affected users
    if (this.config.enableEmailAlerts) {
      await this.sendEmailAlerts(activity, alertMessage);
    }

    // Log the security event
    this.logSecurityEvent(activity);
  }

  // Create system message for suspicious activity
  private async createSystemMessage(
    activity: SuspiciousActivity,
    alertMessage: {
      title: string;
      content: string;
      priority: "high" | "medium" | "low";
    }
  ): Promise<void> {
    try {
      // Note: Security warning system messages will be created server-side
      // when security alerts are detected by the backend monitoring system
      console.log(
        "Security system messages will be created server-side for affected users:",
        activity.affectedUsers
      );
      console.log("Alert details:", alertMessage);
    } catch (error) {
      console.error("Error processing security system message:", error);
    }
  }

  // Send email alerts to affected users
  private async sendEmailAlerts(
    activity: SuspiciousActivity,
    alertMessage: {
      title: string;
      content: string;
      priority: "high" | "medium" | "low";
    }
  ): Promise<void> {
    for (const userId of activity.affectedUsers) {
      try {
        // Note: In a real system, we'd get user data from a user service
        // For now, just log the security alert
        console.log(`Security alert for user ${userId}:`, alertMessage.title);

        // Email alerts would be sent server-side in a real system
        console.log("Email security alert would be sent to user:", userId);
      } catch (error) {
        console.error(
          `Error processing security alert for user ${userId}:`,
          error
        );
      }
    }
  }

  // Log security event for audit purposes
  private logSecurityEvent(activity: SuspiciousActivity): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: "security_alert",
      activity: activity.type,
      severity: activity.severity,
      affectedUsers: activity.affectedUsers,
      details: activity.details,
    };

    try {
      // In a real application, this would be sent to a backend logging service
      const securityLogs = JSON.parse(
        localStorage.getItem("security_logs") || "[]"
      );
      securityLogs.push(logEntry);

      // Keep only the last 100 log entries
      if (securityLogs.length > 100) {
        securityLogs.splice(0, securityLogs.length - 100);
      }

      localStorage.setItem("security_logs", JSON.stringify(securityLogs));
    } catch (error) {
      console.error("Error logging security event:", error);
    }
  }

  // Manually trigger security alert processing (for testing)
  async triggerSecurityCheck(): Promise<SuspiciousActivity[]> {
    const activities = securityMonitoring.getRecentSuspiciousActivities();

    if (activities.length > 0) {
      await this.processSecurityAlerts();
    }

    return activities;
  }

  // Get security configuration
  getConfig(): SecurityAlertConfig {
    return { ...this.config };
  }

  // Update security configuration
  updateConfig(newConfig: Partial<SecurityAlertConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Check if immediate action is required
  requiresImmediateAction(): boolean {
    return securityMonitoring.requiresImmediateAction();
  }

  // Get recent security logs
  getSecurityLogs(): any[] {
    try {
      return JSON.parse(localStorage.getItem("security_logs") || "[]");
    } catch (error) {
      console.error("Error reading security logs:", error);
      return [];
    }
  }

  // Clear security logs (admin function)
  clearSecurityLogs(): void {
    localStorage.removeItem("security_logs");
  }
}

// Export singleton instance
export const securityAlertService = new SecurityAlertService();
