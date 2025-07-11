import type { SystemAuthorizationLevel } from "../types/management";

// Management page configuration
export const MANAGEMENT_CONFIG = {
  confirmDeleteMessage: "Are you sure you want to delete this user?",
  dropdownContainerClass: "dropdown-container",
} as const;

// Authorization level hierarchy for permission checking
export const AUTHORIZATION_LEVEL_HIERARCHY: Record<
  SystemAuthorizationLevel,
  number
> = {
  "Super Admin": 4,
  Administrator: 3,
  Leader: 2,
  Participant: 1, // Changed from 'User: 1'
} as const;

// Authorization level display names and colors
export const AUTHORIZATION_LEVEL_DISPLAY = {
  "Super Admin": {
    label: "Super Admin",
    badgeColor: "bg-red-100 text-red-800",
    iconColor: "text-red-600",
  },
  Administrator: {
    label: "Administrator",
    badgeColor: "bg-purple-100 text-purple-800",
    iconColor: "text-purple-600",
  },
  Leader: {
    label: "Leader",
    badgeColor: "bg-blue-100 text-blue-800",
    iconColor: "text-blue-600",
  },
  Participant: {
    // Changed from 'User'
    label: "Participant",
    badgeColor: "bg-gray-100 text-gray-800",
    iconColor: "text-gray-600",
  },
} as const;

// @Cloud role display
export const AT_CLOUD_ROLE_DISPLAY = {
  "I'm an @Cloud Leader": {
    label: "@Cloud Leader",
    badgeColor: "bg-yellow-100 text-yellow-800",
  },
  "Regular Participant": {
    label: "Regular Participant",
    badgeColor: "bg-green-100 text-green-800",
  },
} as const;
