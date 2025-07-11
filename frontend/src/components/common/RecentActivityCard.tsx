import { useState, useEffect } from "react";

interface ActivityItem {
  id: string;
  message: string;
  color: string;
  timestamp: string;
  type: "signup" | "event" | "profile" | "login" | "security";
}

// Mock function to generate recent activities - replace with API call later
const generateRecentActivities = (): ActivityItem[] => {
  // const currentUserId = 1; // This will come from auth context later when needed for filtering
  const activities: ActivityItem[] = [];

  // Recent event signups (from mock data)
  activities.push({
    id: "activity-1",
    message: "Signed up for Effective Communication Workshop",
    color: "bg-blue-500",
    timestamp: "2 hours ago",
    type: "signup",
  });

  // Profile updates
  activities.push({
    id: "activity-2",
    message: "Updated profile information",
    color: "bg-green-500",
    timestamp: "1 day ago",
    type: "profile",
  });

  // Security updates (password changes)
  activities.push({
    id: "activity-2.5",
    message: "Changed password successfully",
    color: "bg-red-500",
    timestamp: "2 days ago",
    type: "security",
  });

  // Recent login
  activities.push({
    id: "activity-3",
    message: "Logged in successfully",
    color: "bg-orange-500",
    timestamp: "3 days ago",
    type: "login",
  });

  // Event creation (only for authorized roles)
  const userRole = "Administrator"; // This will come from auth context: useAuth().currentUser.role
  if (["Super Admin", "Administrator", "Leader"].includes(userRole)) {
    activities.push({
      id: "activity-4",
      message: "Created new event: Bible Study Series",
      color: "bg-purple-500",
      timestamp: "5 days ago",
      type: "event",
    });
  }

  return activities.slice(0, 4); // Show only recent 4 activities
};

export default function RecentActivityCard() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    // Simulate loading real activity data
    const loadActivities = async () => {
      // In real app, this would be an API call
      const recentActivities = generateRecentActivities();
      setActivities(recentActivities);
    };

    loadActivities();
  }, []);

  if (activities.length === 0) {
    return (
      <div className="text-center py-4">
        <span className="text-sm text-gray-500">No recent activity</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <div key={activity.id} className="flex items-start space-x-3">
          <div
            className={`w-2 h-2 ${activity.color} rounded-full mt-2 flex-shrink-0`}
          ></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-600 break-words">
              {activity.message}
            </p>
            <p className="text-xs text-gray-400 mt-1">{activity.timestamp}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
