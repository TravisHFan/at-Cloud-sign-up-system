import { useRecentActivity } from "../../hooks/useActivity";
import {
  formatRelativeTime,
  getActivityColorClasses,
} from "../../utils/activityUtils";
import { Link } from "react-router-dom";
import { ActivityLoadingState } from "../ui/LoadingStates";

export default function RecentActivityCard() {
  const { activities, isLoading } = useRecentActivity(4);

  if (isLoading) {
    return <ActivityLoadingState count={4} />;
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-6">
        <div className="text-gray-400 text-4xl mb-2">📋</div>
        <span className="text-sm text-gray-500">No recent activity</span>
        <p className="text-xs text-gray-400 mt-1">
          Your activities will appear here as you use the system
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => {
        const colorClasses = getActivityColorClasses(activity.color);

        return (
          <div
            key={activity.id}
            className="flex items-start space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors group"
          >
            {/* Activity Icon/Dot */}
            <div className="flex items-center justify-center mt-1">
              <div
                className={`w-2 h-2 ${colorClasses.dot} rounded-full flex-shrink-0`}
                title={activity.type.replace("_", " ").toUpperCase()}
              ></div>
            </div>

            {/* Activity Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-gray-700 font-medium break-words">
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
                  </p>

                  {activity.description && (
                    <p className="text-xs text-gray-500 mt-1 break-words">
                      {activity.description}
                    </p>
                  )}

                  <div className="flex items-center mt-1 space-x-2">
                    <p className="text-xs text-gray-400">
                      {formatRelativeTime(activity.timestamp)}
                    </p>

                    {activity.priority === "high" && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
                        High Priority
                      </span>
                    )}

                    {activity.isPublic && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-600">
                        Public
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* View All Link */}
      <div className="pt-2 border-t border-gray-100">
        <Link
          to="/dashboard/activities"
          className="text-xs text-blue-600 hover:text-blue-800 font-medium w-full text-center py-1 hover:bg-blue-50 rounded transition-colors block"
        >
          View All Activities
        </Link>
      </div>
    </div>
  );
}
