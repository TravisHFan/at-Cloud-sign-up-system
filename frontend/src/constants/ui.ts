// UI Constants - Centralized styling and component configurations
export const UI_CONSTANTS = {
  // Button styles - using consistent design system
  BUTTON_STYLES: {
    primary:
      "bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors",
    secondary:
      "bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-md font-medium transition-colors",
    success:
      "bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium transition-colors",
    danger:
      "bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-medium transition-colors",
    warning:
      "bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md font-medium transition-colors",
    ghost:
      "bg-transparent text-gray-700 hover:text-gray-900 px-4 py-2 rounded-md font-medium transition-colors",

    // Size variants
    small: "px-3 py-1 text-sm",
    medium: "px-4 py-2",
    large: "px-6 py-3 text-lg",

    // Special variants
    link: "text-blue-600 hover:text-blue-800 underline",
    outline:
      "border border-gray-300 hover:border-gray-400 bg-white text-gray-700 px-4 py-2 rounded-md font-medium transition-colors",
  },

  // Badge/Status styles
  BADGE_STYLES: {
    success:
      "bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium",
    error: "bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium",
    warning:
      "bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-medium",
    info: "bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium",
    neutral:
      "bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium",
    purple:
      "bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium",
  },

  // Sort button styles
  SORT_BUTTON: {
    active: "bg-blue-50 border-blue-300 text-blue-700",
    inactive: "bg-white border-gray-300 text-gray-700 hover:bg-gray-50",
    base: "flex items-center gap-2 px-3 py-2 text-sm border rounded-md transition-colors",
  },

  // Card styles
  CARD_STYLES: {
    base: "bg-white rounded-lg shadow-sm",
    interactive:
      "bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer",
    padding: {
      small: "p-4",
      medium: "p-6",
      large: "p-8",
    },
  },

  // Input styles
  INPUT_STYLES: {
    base: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
    error: "border-red-300 focus:ring-red-500 focus:border-red-500",
    success: "border-green-300 focus:ring-green-500 focus:border-green-500",
  },

  // Animation classes
  ANIMATIONS: {
    fadeIn: "animate-fadeIn",
    slideIn: "animate-slideIn",
    pulse: "animate-pulse",
    spin: "animate-spin",
  },
} as const;

// Event status mapping
export const EVENT_STATUS = {
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  ACTIVE: "active",
  UPCOMING: "upcoming",
} as const;

// Role-based colors for consistent theming
export const ROLE_COLORS = {
  "Super Admin": "purple",
  Administrator: "blue",
  Leader: "green",
  Participant: "gray",
} as const;

// Priority levels
export const PRIORITY_LEVELS = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;

// Loading states configuration
export const LOADING_CONFIG = {
  SKELETON_ROWS: 3,
  SKELETON_DELAY: 200,
  MIN_LOADING_TIME: 500,
} as const;
