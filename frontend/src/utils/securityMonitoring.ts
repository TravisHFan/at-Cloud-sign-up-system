// Security monitoring utility for detecting suspicious login activities
// This simulates real-world security monitoring that would typically happen on the backend

export interface LoginAttempt {
  id: string;
  userId: string;
  username: string;
  email: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  success: boolean;
  location?: {
    country: string;
    city: string;
    region: string;
  };
}

export interface SuspiciousActivity {
  type:
    | "multiple_ips"
    | "unusual_location"
    | "rapid_attempts"
    | "unusual_device";
  severity: "low" | "medium" | "high";
  description: string;
  affectedUsers: string[];
  details: any;
}

class SecurityMonitoringService {
  private loginAttempts: LoginAttempt[] = [];
  private readonly MAX_IPS_PER_USER = 3;
  private readonly RAPID_ATTEMPT_THRESHOLD = 5; // attempts within 10 minutes

  constructor() {
    // Load existing login attempts from localStorage
    this.loadLoginAttempts();
  }

  private loadLoginAttempts(): void {
    try {
      const stored = localStorage.getItem("security_login_attempts");
      if (stored) {
        this.loginAttempts = JSON.parse(stored);
        // Clean up old attempts (older than 24 hours)
        this.cleanupOldAttempts();
      }
    } catch (error) {
      console.error("Error loading login attempts:", error);
      this.loginAttempts = [];
    }
  }

  private saveLoginAttempts(): void {
    try {
      localStorage.setItem(
        "security_login_attempts",
        JSON.stringify(this.loginAttempts)
      );
    } catch (error) {
      console.error("Error saving login attempts:", error);
    }
  }

  private cleanupOldAttempts(): void {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.loginAttempts = this.loginAttempts.filter(
      (attempt) => new Date(attempt.timestamp) > twentyFourHoursAgo
    );
    this.saveLoginAttempts();
  }

  // Simulate getting client information (in real app, this would come from the server)
  private getClientInfo(): {
    ipAddress: string;
    userAgent: string;
    location?: any;
  } {
    // Simulate various IP addresses and locations for demonstration
    const mockIPs = [
      "192.168.1.100",
      "203.0.113.45",
      "198.51.100.23",
      "172.16.0.55",
      "10.0.0.42",
    ];

    const mockLocations = [
      { country: "United States", city: "New York", region: "NY" },
      { country: "United Kingdom", city: "London", region: "England" },
      { country: "Germany", city: "Berlin", region: "Berlin" },
      { country: "Japan", city: "Tokyo", region: "Tokyo" },
      { country: "Canada", city: "Toronto", region: "ON" },
    ];

    const randomIndex = Math.floor(Math.random() * mockIPs.length);

    return {
      ipAddress: mockIPs[randomIndex],
      userAgent: navigator.userAgent,
      location: mockLocations[randomIndex],
    };
  }

  // Record a login attempt
  recordLoginAttempt(
    userId: string,
    username: string,
    email: string,
    success: boolean
  ): LoginAttempt {
    const clientInfo = this.getClientInfo();

    const attempt: LoginAttempt = {
      id: `login_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      username,
      email,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      timestamp: new Date().toISOString(),
      success,
      location: clientInfo.location,
    };

    this.loginAttempts.push(attempt);
    this.saveLoginAttempts();

    return attempt;
  }

  // Analyze login patterns for suspicious activity
  analyzeSuspiciousActivity(): SuspiciousActivity[] {
    const suspiciousActivities: SuspiciousActivity[] = [];
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

    // Group attempts by user
    const userAttempts = this.groupAttemptsByUser();

    for (const [userId, attempts] of userAttempts.entries()) {
      // Check for multiple IP addresses
      const recentAttempts = attempts.filter(
        (a) => new Date(a.timestamp) > oneHourAgo
      );
      const uniqueIPs = new Set(recentAttempts.map((a) => a.ipAddress));

      if (uniqueIPs.size > this.MAX_IPS_PER_USER) {
        suspiciousActivities.push({
          type: "multiple_ips",
          severity: "high",
          description: `User logged in from ${uniqueIPs.size} different IP addresses within the last hour`,
          affectedUsers: [userId],
          details: {
            ipAddresses: Array.from(uniqueIPs),
            attemptCount: recentAttempts.length,
            locations: recentAttempts.map((a) => a.location).filter(Boolean),
          },
        });
      }

      // Check for rapid login attempts
      const rapidAttempts = attempts.filter(
        (a) => new Date(a.timestamp) > tenMinutesAgo
      );
      if (rapidAttempts.length >= this.RAPID_ATTEMPT_THRESHOLD) {
        suspiciousActivities.push({
          type: "rapid_attempts",
          severity: "medium",
          description: `${rapidAttempts.length} login attempts detected within 10 minutes`,
          affectedUsers: [userId],
          details: {
            attemptCount: rapidAttempts.length,
            successCount: rapidAttempts.filter((a) => a.success).length,
            failureCount: rapidAttempts.filter((a) => !a.success).length,
          },
        });
      }

      // Check for unusual locations (simplified)
      if (recentAttempts.length > 2) {
        const locations = recentAttempts.map((a) => a.location).filter(Boolean);
        const uniqueCountries = new Set(locations.map((l) => l?.country));

        if (uniqueCountries.size > 2) {
          suspiciousActivities.push({
            type: "unusual_location",
            severity: "medium",
            description: `Login attempts from ${uniqueCountries.size} different countries`,
            affectedUsers: [userId],
            details: {
              countries: Array.from(uniqueCountries),
              locations: locations,
            },
          });
        }
      }
    }

    return suspiciousActivities;
  }

  private groupAttemptsByUser(): Map<string, LoginAttempt[]> {
    const userAttempts = new Map<string, LoginAttempt[]>();

    for (const attempt of this.loginAttempts) {
      if (!userAttempts.has(attempt.userId)) {
        userAttempts.set(attempt.userId, []);
      }
      userAttempts.get(attempt.userId)!.push(attempt);
    }

    return userAttempts;
  }

  // Get login statistics for a user
  getUserLoginStats(userId: string): {
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    uniqueIPs: number;
    lastLogin?: string;
    recentAttempts: LoginAttempt[];
  } {
    const userAttempts = this.loginAttempts.filter((a) => a.userId === userId);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentAttempts = userAttempts.filter(
      (a) => new Date(a.timestamp) > oneHourAgo
    );

    const successfulAttempts = userAttempts.filter((a) => a.success);
    const lastSuccessful = successfulAttempts.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )[0];

    return {
      totalAttempts: userAttempts.length,
      successfulAttempts: successfulAttempts.length,
      failedAttempts: userAttempts.filter((a) => !a.success).length,
      uniqueIPs: new Set(userAttempts.map((a) => a.ipAddress)).size,
      lastLogin: lastSuccessful?.timestamp,
      recentAttempts,
    };
  }

  // Clear old login attempts (maintenance function)
  clearOldAttempts(): void {
    this.cleanupOldAttempts();
  }

  // Get all recent suspicious activities
  getRecentSuspiciousActivities(): SuspiciousActivity[] {
    return this.analyzeSuspiciousActivity();
  }

  // Check if immediate security response is needed
  requiresImmediateAction(): boolean {
    const suspiciousActivities = this.analyzeSuspiciousActivity();
    return suspiciousActivities.some(
      (activity) => activity.severity === "high"
    );
  }
}

// Export singleton instance
export const securityMonitoring = new SecurityMonitoringService();

// Utility functions
export function generateSecurityAlertMessage(activity: SuspiciousActivity): {
  title: string;
  content: string;
  priority: "high" | "medium" | "low";
} {
  let title: string;
  let content: string;

  switch (activity.type) {
    case "multiple_ips":
      title = "⚠️ Suspicious Login Activity Detected";
      content = `Our security system has detected unusual login patterns from multiple IP addresses. If you notice any unauthorized access to your account, please change your password immediately and contact our support team. We've temporarily enhanced monitoring for all accounts as a precautionary measure.

Detected: ${activity.details.attemptCount} login attempts from ${activity.details.ipAddresses.length} different IP addresses.

If this was you accessing your account from different locations, you can safely ignore this message. Otherwise, please take immediate action to secure your account.`;
      break;

    case "rapid_attempts":
      title = "🔐 Multiple Login Attempts Detected";
      content = `We've detected ${activity.details.attemptCount} login attempts to your account within a short time period. This could indicate an attempted unauthorized access.

Success rate: ${activity.details.successCount}/${activity.details.attemptCount} attempts

If you were trying to log in and experienced difficulties, this is normal. If you weren't attempting to access your account, please change your password immediately.`;
      break;

    case "unusual_location":
      title = "🌍 Login from New Locations";
      content = `Your account has been accessed from multiple geographic locations recently. We've detected logins from: ${activity.details.countries.join(
        ", "
      )}.

If you've been traveling or using a VPN, this is expected behavior. If you haven't authorized these login locations, please secure your account immediately by changing your password.`;
      break;

    case "unusual_device":
      title = "📱 New Device Access Detected";
      content = `We've detected login attempts from unrecognized devices or browsers. This could be normal if you're using a new device, browser, or cleared your browser data.

If you don't recognize this activity, please change your password and review your recent account activity.`;
      break;

    default:
      title = "🛡️ Security Alert";
      content = `We've detected unusual activity on your account. As a precautionary measure, please review your recent account activity and consider changing your password if you notice anything suspicious.`;
  }

  return {
    title,
    content,
    priority: activity.severity,
  };
}
