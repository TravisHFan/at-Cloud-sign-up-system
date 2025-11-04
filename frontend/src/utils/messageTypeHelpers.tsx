import type { ReactElement } from "react";
import Icon from "../components/common/Icon";

/**
 * Utility functions for rendering system message type icons, colors, and priority styling.
 * Used by SystemMessages components to maintain consistent visual representation.
 */

export const messageTypeHelpers = {
  /**
   * Get the priority badge color classes based on priority level
   */
  getPriorityColor(priority: string): string {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  },

  /**
   * Get the icon element for a system message type
   * @param type - The message type (announcement, maintenance, update, etc.)
   * @param message - Optional message object for context (e.g., checking title)
   */
  getTypeIcon(type: string, message?: { title?: string }): ReactElement {
    switch (type) {
      case "announcement":
        return (
          <img
            src="/marketing.svg"
            alt="Marketing"
            className="w-7 h-7"
            style={{
              filter:
                "brightness(0) saturate(100%) invert(26%) sepia(94%) saturate(6338%) hue-rotate(212deg) brightness(99%) contrast(91%)",
            }}
          />
        );
      case "maintenance":
        return <Icon name="shield-check" className="w-5 h-5 text-orange-400" />; // Shield for system maintenance/protection
      case "update":
        return <Icon name="check-circle" className="w-5 h-5" />; // Check circle for successful updates
      case "warning":
        return <Icon name="x-circle" className="w-5 h-5" />; // X circle for warnings/alerts
      case "auth_level_change":
        return (
          <img
            src="/permission-management.svg"
            alt="Permission Management"
            className="w-7 h-7"
            style={{
              filter:
                "brightness(0) saturate(100%) invert(52%) sepia(41%) saturate(459%) hue-rotate(74deg) brightness(98%) contrast(90%)",
            }}
          />
        ); // New icon for auth level changes
      case "user_management": {
        const title = (message?.title || "").toLowerCase();
        const isRed =
          title.includes("deactivated") || title.includes("deleted");
        const colorClass = isRed ? "text-red-600" : "text-green-600"; // keep green for reactivated
        return <Icon name="user" className={`w-5 h-5 ${colorClass}`} />; // Old auth icon reused with dynamic color
      }
      case "atcloud_role_change":
        return <Icon name="tag" className="w-5 h-5" />; // Tag icon for @Cloud ministry role changes
      case "event_role_change":
        return (
          <img
            src="/change.svg"
            alt="Role Change"
            className="w-7 h-7"
            style={{
              filter:
                "brightness(0) saturate(100%) invert(41%) sepia(68%) saturate(2557%) hue-rotate(180deg) brightness(95%) contrast(101%)",
            }}
          />
        ); // Change icon for event role changes
      default:
        return <Icon name="mail" className="w-5 h-5" />;
    }
  },

  /**
   * Get the color class for a system message type
   * @param type - The message type (announcement, maintenance, update, etc.)
   * @param message - Optional message object for context (e.g., checking title)
   */
  getTypeColor(type: string, message?: { title?: string }): string {
    switch (type) {
      case "announcement":
        return "text-blue-600"; // Blue for announcements (marketing)
      case "maintenance":
        return "text-orange-400"; // Light orange for maintenance (shield)
      case "update":
        return "text-green-600"; // Green for updates (check)
      case "warning":
        return "text-red-600"; // Red for warnings (x-circle)
      case "auth_level_change":
        return "text-green-600"; // Keep green coloring for permission icon
      case "user_management": {
        const title = (message?.title || "").toLowerCase();
        const isRed =
          title.includes("deactivated") || title.includes("deleted");
        return isRed ? "text-red-600" : "text-green-600";
      }
      case "atcloud_role_change":
        return "text-purple-600"; // Purple for @Cloud ministry role changes (tag)
      default:
        return "text-gray-600";
    }
  },
};
