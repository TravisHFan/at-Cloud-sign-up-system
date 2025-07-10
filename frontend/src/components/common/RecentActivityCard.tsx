interface ActivityItem {
  message: string;
  color: string;
}

const recentActivities: ActivityItem[] = [
  {
    message: "Account created successfully",
    color: "bg-blue-500",
  },
  {
    message: "Profile setup completed",
    color: "bg-green-500",
  },
  {
    message: "Welcome email sent",
    color: "bg-purple-500",
  },
];

export default function RecentActivityCard() {
  return (
    <div className="space-y-3">
      {recentActivities.map((activity, index) => (
        <div key={index} className="flex items-center space-x-3">
          <div className={`w-2 h-2 ${activity.color} rounded-full`}></div>
          <span className="text-sm text-gray-600">{activity.message}</span>
        </div>
      ))}
    </div>
  );
}