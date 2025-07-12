/**
 * Format a timestamp to a human-readable relative time string
 */
export function formatRelativeTime(timestamp: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor(
    (now.getTime() - timestamp.getTime()) / 1000
  );

  if (diffInSeconds < 60) {
    return "Just now";
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} ${diffInMinutes === 1 ? "minute" : "minutes"} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? "hour" : "hours"} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} ${diffInDays === 1 ? "day" : "days"} ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks} ${diffInWeeks === 1 ? "week" : "weeks"} ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} ${diffInMonths === 1 ? "month" : "months"} ago`;
  }

  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears} ${diffInYears === 1 ? "year" : "years"} ago`;
}

/**
 * Format timestamp for detailed display
 */
export function formatDetailedTime(timestamp: Date): string {
  return timestamp.toLocaleString();
}

/**
 * Get activity color classes for Tailwind CSS
 */
export function getActivityColorClasses(color: string): {
  dot: string;
  bg: string;
  text: string;
  border: string;
} {
  const colorMap: Record<
    string,
    { dot: string; bg: string; text: string; border: string }
  > = {
    "bg-blue-500": {
      dot: "bg-blue-500",
      bg: "bg-blue-50",
      text: "text-blue-700",
      border: "border-blue-200",
    },
    "bg-green-500": {
      dot: "bg-green-500",
      bg: "bg-green-50",
      text: "text-green-700",
      border: "border-green-200",
    },
    "bg-red-500": {
      dot: "bg-red-500",
      bg: "bg-red-50",
      text: "text-red-700",
      border: "border-red-200",
    },
    "bg-red-600": {
      dot: "bg-red-600",
      bg: "bg-red-50",
      text: "text-red-700",
      border: "border-red-200",
    },
    "bg-red-700": {
      dot: "bg-red-700",
      bg: "bg-red-50",
      text: "text-red-800",
      border: "border-red-300",
    },
    "bg-purple-500": {
      dot: "bg-purple-500",
      bg: "bg-purple-50",
      text: "text-purple-700",
      border: "border-purple-200",
    },
    "bg-indigo-500": {
      dot: "bg-indigo-500",
      bg: "bg-indigo-50",
      text: "text-indigo-700",
      border: "border-indigo-200",
    },
    "bg-orange-500": {
      dot: "bg-orange-500",
      bg: "bg-orange-50",
      text: "text-orange-700",
      border: "border-orange-200",
    },
    "bg-cyan-500": {
      dot: "bg-cyan-500",
      bg: "bg-cyan-50",
      text: "text-cyan-700",
      border: "border-cyan-200",
    },
    "bg-yellow-500": {
      dot: "bg-yellow-500",
      bg: "bg-yellow-50",
      text: "text-yellow-700",
      border: "border-yellow-200",
    },
    "bg-emerald-500": {
      dot: "bg-emerald-500",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
    },
    "bg-teal-500": {
      dot: "bg-teal-500",
      bg: "bg-teal-50",
      text: "text-teal-700",
      border: "border-teal-200",
    },
    "bg-slate-600": {
      dot: "bg-slate-600",
      bg: "bg-slate-50",
      text: "text-slate-700",
      border: "border-slate-200",
    },
    "bg-gray-500": {
      dot: "bg-gray-500",
      bg: "bg-gray-50",
      text: "text-gray-700",
      border: "border-gray-200",
    },
  };

  return (
    colorMap[color] || {
      dot: "bg-gray-500",
      bg: "bg-gray-50",
      text: "text-gray-700",
      border: "border-gray-200",
    }
  );
}

/**
 * Get priority badge classes
 */
export function getPriorityBadge(priority: "low" | "medium" | "high"): {
  classes: string;
  label: string;
} {
  const priorityMap = {
    low: {
      classes: "bg-gray-100 text-gray-600 border-gray-200",
      label: "Low",
    },
    medium: {
      classes: "bg-blue-100 text-blue-600 border-blue-200",
      label: "Medium",
    },
    high: {
      classes: "bg-red-100 text-red-600 border-red-200",
      label: "High",
    },
  };

  return priorityMap[priority];
}
