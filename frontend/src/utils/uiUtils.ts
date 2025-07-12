// Shared UI utility functions
import { UI_CONSTANTS, EVENT_STATUS } from "../constants/ui";
import type { SystemAuthorizationLevel } from "../types";

/**
 * Get button class names based on variant and size
 */
export function getButtonClass(
  variant: keyof typeof UI_CONSTANTS.BUTTON_STYLES = "primary",
  size: "small" | "medium" | "large" = "medium",
  additional?: string
): string {
  const baseClass =
    UI_CONSTANTS.BUTTON_STYLES[variant] || UI_CONSTANTS.BUTTON_STYLES.primary;
  const sizeClass =
    UI_CONSTANTS.BUTTON_STYLES[size] || UI_CONSTANTS.BUTTON_STYLES.medium;

  return `${baseClass} ${sizeClass} ${additional || ""}`.trim();
}

/**
 * Get badge class names based on status/type
 */
export function getBadgeClass(
  type: keyof typeof UI_CONSTANTS.BADGE_STYLES = "neutral",
  additional?: string
): string {
  const baseClass =
    UI_CONSTANTS.BADGE_STYLES[type] || UI_CONSTANTS.BADGE_STYLES.neutral;
  return `${baseClass} ${additional || ""}`.trim();
}

/**
 * Get sort button class names based on active state
 */
export function getSortButtonClass(
  isActive: boolean,
  additional?: string
): string {
  const stateClass = isActive
    ? UI_CONSTANTS.SORT_BUTTON.active
    : UI_CONSTANTS.SORT_BUTTON.inactive;

  return `${UI_CONSTANTS.SORT_BUTTON.base} ${stateClass} ${
    additional || ""
  }`.trim();
}

/**
 * Get card class names based on type and padding
 */
export function getCardClass(
  interactive: boolean = false,
  padding: "small" | "medium" | "large" = "medium",
  additional?: string
): string {
  const baseClass = interactive
    ? UI_CONSTANTS.CARD_STYLES.interactive
    : UI_CONSTANTS.CARD_STYLES.base;
  const paddingClass = UI_CONSTANTS.CARD_STYLES.padding[padding];

  return `${baseClass} ${paddingClass} ${additional || ""}`.trim();
}

/**
 * Get input class names based on state
 */
export function getInputClass(
  state: "normal" | "error" | "success" = "normal",
  additional?: string
): string {
  let stateClass = "";
  if (state === "error") stateClass = UI_CONSTANTS.INPUT_STYLES.error;
  if (state === "success") stateClass = UI_CONSTANTS.INPUT_STYLES.success;

  return `${UI_CONSTANTS.INPUT_STYLES.base} ${stateClass} ${
    additional || ""
  }`.trim();
}

/**
 * Get role-based badge styling
 */
export function getRoleBadgeClass(role: SystemAuthorizationLevel): string {
  const colorMap: Record<
    SystemAuthorizationLevel,
    keyof typeof UI_CONSTANTS.BADGE_STYLES
  > = {
    "Super Admin": "purple",
    Administrator: "info",
    Leader: "success",
    Participant: "neutral",
  };

  return getBadgeClass(colorMap[role] || "neutral");
}

/**
 * Get event status badge styling
 */
export function getEventStatusBadge(
  status: string,
  eventType: "upcoming" | "passed" = "upcoming"
): {
  text: string;
  className: string;
} {
  if (status === EVENT_STATUS.CANCELLED) {
    return {
      text: "Cancelled",
      className: getBadgeClass("error"),
    };
  }

  if (eventType === "passed") {
    return {
      text: status === EVENT_STATUS.COMPLETED ? "Completed" : "Cancelled",
      className: getBadgeClass(
        status === EVENT_STATUS.COMPLETED ? "success" : "error"
      ),
    };
  }

  // For upcoming events, show availability
  return {
    text: "Active",
    className: getBadgeClass("success"),
  };
}

/**
 * Get availability badge for events
 */
export function getAvailabilityBadge(spotsLeft: number): {
  text: string;
  className: string;
} | null {
  if (spotsLeft === 0) {
    return {
      text: "Full",
      className: getBadgeClass("error"),
    };
  }

  if (spotsLeft <= 5) {
    return {
      text: `${spotsLeft} spots left`,
      className: getBadgeClass("warning"),
    };
  }

  return null; // Don't show badge if plenty of spots
}

/**
 * Combine multiple class names safely
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Get consistent loading skeleton classes
 */
export function getLoadingSkeletonClass(
  type: "text" | "circle" | "rect" = "rect"
): string {
  const base = "animate-pulse bg-gray-200";

  switch (type) {
    case "text":
      return `${base} h-4 rounded`;
    case "circle":
      return `${base} rounded-full`;
    case "rect":
    default:
      return `${base} rounded`;
  }
}
