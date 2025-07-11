// Utility for simulating suspicious login activities for testing the security system
// This is for demonstration purposes only

import { securityMonitoring } from "./securityMonitoring";
import { securityAlertService } from "./securityAlertService";
import { findUserByEmail, getAllUsers } from "../data/mockUserData";

export class SecurityTestUtils {
  // Simulate multiple IP addresses login attempts for a user
  static async simulateMultipleIPLogins(
    username: string = "testuser",
    count: number = 4
  ): Promise<void> {
    const user = findUserByEmail(`${username}@example.com`) ||
      findUserByEmail(username) || {
        id: `user_${username}`,
        email: `${username}@example.com`,
      };

    console.log(
      `🔒 Simulating ${count} login attempts from different IPs for user: ${username}`
    );

    // Create multiple login attempts with different "IP addresses" rapidly
    for (let i = 0; i < count; i++) {
      securityMonitoring.recordLoginAttempt(
        user.id,
        username,
        user.email,
        Math.random() > 0.3 // Most attempts succeed to trigger the multiple IP alert
      );

      // Small delay to make timestamps slightly different
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Process security alerts
    await securityAlertService.processSecurityAlerts();

    console.log("✅ Multiple IP simulation complete");
  }

  // Simulate rapid login attempts
  static async simulateRapidAttempts(
    username: string = "testuser2",
    count: number = 6
  ): Promise<void> {
    const user = findUserByEmail(`${username}@example.com`) ||
      findUserByEmail(username) || {
        id: `user_${username}`,
        email: `${username}@example.com`,
      };

    console.log(
      `🔒 Simulating ${count} rapid login attempts for user: ${username}`
    );

    // Create rapid login attempts (within 10 minutes)
    for (let i = 0; i < count; i++) {
      securityMonitoring.recordLoginAttempt(
        user.id,
        username,
        user.email,
        i % 3 === 0 // Some failures mixed with successes
      );

      // Very small delay between attempts
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Process security alerts
    await securityAlertService.processSecurityAlerts();

    console.log("✅ Rapid attempts simulation complete");
  }

  // Simulate unusual location access
  static async simulateUnusualLocations(
    username: string = "testuser3",
    count: number = 4
  ): Promise<void> {
    const user = findUserByEmail(`${username}@example.com`) ||
      findUserByEmail(username) || {
        id: `user_${username}`,
        email: `${username}@example.com`,
      };

    console.log(
      `🔒 Simulating login attempts from ${count} different locations for user: ${username}`
    );

    // The security monitoring service already randomly assigns different locations
    // so we just need to create enough attempts to trigger the unusual location alert
    for (let i = 0; i < count; i++) {
      securityMonitoring.recordLoginAttempt(
        user.id,
        username,
        user.email,
        true // All successful to focus on location diversity
      );

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Process security alerts
    await securityAlertService.processSecurityAlerts();

    console.log("✅ Unusual locations simulation complete");
  }

  // Simulate the exact scenario from the mock message
  static async simulateSuspiciousActivityScenario(): Promise<void> {
    console.log("🔒 Simulating the suspicious login activity scenario...");

    // Get a real user from the system
    const users = getAllUsers();
    const targetUser = users[0] || {
      id: "user_demo",
      email: "demo@example.com",
      firstName: "Demo",
      lastName: "User",
    };

    // Simulate the scenario described in the mock message:
    // "Our security system has detected unusual login patterns from multiple IP addresses"

    // Create 5 login attempts from different IPs within a short time
    for (let i = 0; i < 5; i++) {
      securityMonitoring.recordLoginAttempt(
        targetUser.id,
        targetUser.email.split("@")[0], // username from email
        targetUser.email,
        i < 4 // First 4 succeed, last one fails
      );

      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Process the security alerts - this should generate the system message
    await securityAlertService.processSecurityAlerts();

    console.log("✅ Suspicious activity scenario simulation complete!");
    console.log("Check the System Messages page to see the security alert.");
  }

  // Get current security statistics
  static getSecurityStats(): {
    totalAttempts: number;
    suspiciousActivities: number;
    recentAlerts: any[];
  } {
    const allAttempts = JSON.parse(
      localStorage.getItem("security_login_attempts") || "[]"
    );
    const suspiciousActivities =
      securityMonitoring.getRecentSuspiciousActivities();
    const recentAlerts = securityAlertService.getSecurityLogs();

    return {
      totalAttempts: allAttempts.length,
      suspiciousActivities: suspiciousActivities.length,
      recentAlerts: recentAlerts.slice(-10), // Last 10 alerts
    };
  }

  // Clear all security data (for testing)
  static clearAllSecurityData(): void {
    localStorage.removeItem("security_login_attempts");
    localStorage.removeItem("security_logs");
    securityAlertService.clearSecurityLogs();
    console.log("🧹 All security data cleared");
  }

  // Show security dashboard in console
  static showSecurityDashboard(): void {
    const stats = this.getSecurityStats();
    const activities = securityMonitoring.getRecentSuspiciousActivities();

    console.log("🔒 SECURITY DASHBOARD");
    console.log("====================");
    console.log(`Total Login Attempts: ${stats.totalAttempts}`);
    console.log(`Suspicious Activities: ${stats.suspiciousActivities}`);
    console.log(`Recent Alerts: ${stats.recentAlerts.length}`);
    console.log("");

    if (activities.length > 0) {
      console.log("Active Suspicious Activities:");
      activities.forEach((activity, index) => {
        console.log(
          `${index + 1}. ${activity.type} (${activity.severity}) - ${
            activity.description
          }`
        );
      });
    } else {
      console.log("No suspicious activities detected.");
    }
  }
}

// Export for easy access in browser console for testing
declare global {
  interface Window {
    SecurityTestUtils: typeof SecurityTestUtils;
  }
}

if (typeof window !== "undefined") {
  window.SecurityTestUtils = SecurityTestUtils;
}

export default SecurityTestUtils;
