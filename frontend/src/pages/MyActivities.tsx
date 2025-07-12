import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useActivityFilters } from "../hooks/useActivity";
import {
  formatRelativeTime,
  formatDetailedTime,
  getActivityColorClasses,
  getPriorityBadge,
} from "../utils/activityUtils";
import type { ActivityType } from "../services/activityService";

export default function MyActivities() {
  const { userId } = useParams<{ userId?: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // State for filters
  const [selectedTypes, setSelectedTypes] = useState<ActivityType[]>([]);
  const [dateRange, setDateRange] = useState<"all" | "7days" | "30days">("all");
  const [showDetails, setShowDetails] = useState<string | null>(null);

  // Determine target user (for viewing other user's activities)
  const targetUserId = userId || currentUser?.id || "";
  const isViewingOwnActivities = !userId || userId === currentUser?.id;
  const isAdmin =
    currentUser && ["Super Admin", "Administrator"].includes(currentUser.role);

  // Authorization check for viewing other user's activities
  useEffect(() => {
    if (userId && userId !== currentUser?.id && !isAdmin) {
      navigate("/dashboard", { replace: true });
    }
  }, [userId, currentUser, isAdmin, navigate]);

  // Calculate date filter
  const getDateFilter = () => {
    const now = new Date();
    switch (dateRange) {
      case "7days":
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case "30days":
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return undefined;
    }
  };

  // Memoize the filters object to prevent infinite re-renders
  const filters = useMemo(
    () => ({
      userId: targetUserId,
      types: selectedTypes.length > 0 ? selectedTypes : undefined,
      startDate: getDateFilter(),
      limit: 100,
      includePublic: isViewingOwnActivities,
    }),
    [targetUserId, selectedTypes, dateRange, isViewingOwnActivities]
  );

  // Get filtered activities
  const { activities, isLoading } = useActivityFilters(filters);

  // Activity type options for filtering
  const activityTypeOptions: {
    value: ActivityType;
    label: string;
    color: string;
  }[] = [
    { value: "login", label: "Login", color: "bg-green-500" },
    { value: "logout", label: "Logout", color: "bg-gray-500" },
    { value: "signup", label: "Event Signup", color: "bg-blue-500" },
    {
      value: "profile_update",
      label: "Profile Update",
      color: "bg-emerald-500",
    },
    { value: "password_change", label: "Password Change", color: "bg-red-500" },
    { value: "event_create", label: "Event Creation", color: "bg-purple-500" },
    { value: "event_update", label: "Event Update", color: "bg-indigo-500" },
    { value: "event_delete", label: "Event Deletion", color: "bg-red-600" },
    {
      value: "user_management",
      label: "User Management",
      color: "bg-orange-500",
    },
    { value: "chat_message", label: "Chat Message", color: "bg-cyan-500" },
    { value: "notification", label: "Notification", color: "bg-yellow-500" },
    { value: "security_alert", label: "Security Alert", color: "bg-red-700" },
    { value: "data_export", label: "Data Export", color: "bg-teal-500" },
    { value: "system_config", label: "System Config", color: "bg-slate-600" },
  ];

  const handleTypeFilter = (type: ActivityType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const clearFilters = () => {
    setSelectedTypes([]);
    setDateRange("all");
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-100 rounded w-2/3 mb-8"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-100 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {isViewingOwnActivities ? "My Activities" : `User Activities`}
        </h1>

        {/* Data Retention Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <span className="text-blue-500 text-xl">ℹ️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Data Retention Policy
              </h3>
              <p className="mt-1 text-sm text-blue-700">
                Activities are automatically deleted after 30 days to maintain
                system performance and privacy. Only activities from the last
                month are displayed.
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Filters</h3>

          {/* Date Range Filter */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Time Period
            </label>
            <div className="flex space-x-2">
              {[
                { value: "all", label: "All Time" },
                { value: "7days", label: "Last 7 Days" },
                { value: "30days", label: "Last 30 Days" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setDateRange(option.value as any)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    dateRange === option.value
                      ? "bg-blue-100 text-blue-700 border-blue-300"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  } border`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Activity Type Filter */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Activity Types
            </label>
            <div className="flex flex-wrap gap-2">
              {activityTypeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleTypeFilter(option.value)}
                  className={`inline-flex items-center px-3 py-1 rounded-md text-sm font-medium transition-colors border ${
                    selectedTypes.includes(option.value)
                      ? "bg-blue-100 text-blue-700 border-blue-300"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300"
                  }`}
                >
                  <div
                    className={`w-2 h-2 ${option.color} rounded-full mr-2`}
                  ></div>
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clear Filters */}
          {(selectedTypes.length > 0 || dateRange !== "all") && (
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear All Filters
            </button>
          )}
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-600">
            Showing {activities.length} activities
            {selectedTypes.length > 0 &&
              ` filtered by ${selectedTypes.length} types`}
            {dateRange !== "all" &&
              ` from ${dateRange === "7days" ? "last 7 days" : "last 30 days"}`}
          </p>
        </div>
      </div>

      {/* Activities List */}
      {activities.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📋</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Activities Found
          </h3>
          <p className="text-gray-600">
            {selectedTypes.length > 0 || dateRange !== "all"
              ? "Try adjusting your filters to see more activities."
              : isViewingOwnActivities
              ? "Your activities will appear here as you use the system."
              : "This user has no recorded activities."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => {
            const colorClasses = getActivityColorClasses(activity.color);
            const priorityBadge = getPriorityBadge(activity.priority);
            const isExpanded = showDetails === activity.id;

            return (
              <div
                key={activity.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    {/* Activity Indicator */}
                    <div className="flex items-center justify-center mt-1">
                      <div
                        className={`w-3 h-3 ${colorClasses.dot} rounded-full`}
                      ></div>
                    </div>

                    {/* Activity Content */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-sm font-medium text-gray-900">
                            {activity.icon && (
                              <span
                                className="mr-2"
                                role="img"
                                aria-label={activity.type}
                              >
                                {activity.icon}
                              </span>
                            )}
                            {activity.title}
                          </h3>

                          {activity.description && (
                            <p className="text-sm text-gray-600 mt-1">
                              {activity.description}
                            </p>
                          )}

                          <div className="flex items-center mt-2 space-x-3">
                            <span className="text-xs text-gray-500">
                              {formatRelativeTime(activity.timestamp)}
                            </span>

                            {activity.priority === "high" && (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${priorityBadge.classes}`}
                              >
                                {priorityBadge.label}
                              </span>
                            )}

                            {activity.isPublic && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-600">
                                Public
                              </span>
                            )}

                            <span className="text-xs text-gray-400 capitalize">
                              {activity.type.replace("_", " ")}
                            </span>
                          </div>
                        </div>

                        {/* Expand Button */}
                        {activity.metadata &&
                          Object.keys(activity.metadata).length > 0 && (
                            <button
                              onClick={() =>
                                setShowDetails(isExpanded ? null : activity.id)
                              }
                              className="text-gray-400 hover:text-gray-600 ml-4"
                            >
                              <svg
                                className={`w-5 h-5 transform transition-transform ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </button>
                          )}
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && activity.metadata && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <h4 className="text-xs font-medium text-gray-700 mb-2">
                            Activity Details
                          </h4>
                          <div className="bg-gray-50 rounded-md p-3">
                            <div className="text-xs text-gray-600 mb-2">
                              <strong>Timestamp:</strong>{" "}
                              {formatDetailedTime(activity.timestamp)}
                            </div>
                            <div className="text-xs text-gray-600 space-y-1">
                              {Object.entries(activity.metadata).map(
                                ([key, value]) => (
                                  <div key={key}>
                                    <strong className="capitalize">
                                      {key.replace("_", " ")}:
                                    </strong>{" "}
                                    {typeof value === "object"
                                      ? JSON.stringify(value)
                                      : String(value)}
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
