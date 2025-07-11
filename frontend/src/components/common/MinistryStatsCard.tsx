import { useState, useEffect } from "react";
import {
  mockUpcomingEventsDynamic,
  mockPassedEventsDynamic,
} from "../../data/mockEventData";

interface StatItem {
  label: string;
  value: string | number;
  colorClass: string;
}

// Function to calculate real ministry statistics
const calculateMinistryStats = (): StatItem[] => {
  const upcomingEvents = mockUpcomingEventsDynamic.filter(
    (event) => event.status !== "cancelled"
  );
  const completedEvents = mockPassedEventsDynamic.filter(
    (event) => event.status === "completed"
  );
  const totalEvents = upcomingEvents.length + completedEvents.length;

  // Calculate total signups across all upcoming events
  const totalSignups = upcomingEvents.reduce(
    (total, event) => total + (event.signedUp || 0),
    0
  );

  // Calculate total slots available
  const totalSlots = upcomingEvents.reduce(
    (total, event) => total + (event.totalSlots || 0),
    0
  );

  return [
    {
      label: "Total Events",
      value: totalEvents,
      colorClass: "text-gray-900",
    },
    {
      label: "Upcoming Events",
      value: upcomingEvents.length,
      colorClass: "text-blue-600",
    },
    {
      label: "Total Signups",
      value: totalSignups,
      colorClass: "text-green-600",
    },
    {
      label: "Available Spots",
      value: Math.max(0, totalSlots - totalSignups),
      colorClass: "text-orange-600",
    },
  ];
};

export default function MinistryStatsCard() {
  const [ministryStats, setMinistryStats] = useState<StatItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading real statistics
    const loadStats = async () => {
      try {
        // In real app, this would be an API call to get statistics
        const stats = calculateMinistryStats();
        setMinistryStats(stats);
      } catch (error) {
        console.error("Error loading ministry stats:", error);
        // Fallback to default stats
        setMinistryStats([
          { label: "Total Events", value: 0, colorClass: "text-gray-900" },
          { label: "Upcoming Events", value: 0, colorClass: "text-blue-600" },
          { label: "Total Signups", value: 0, colorClass: "text-green-600" },
          { label: "Available Spots", value: 0, colorClass: "text-orange-600" },
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex justify-between items-center">
            <div className="bg-gray-200 h-4 w-20 rounded animate-pulse"></div>
            <div className="bg-gray-200 h-6 w-8 rounded animate-pulse"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {ministryStats.map((stat) => (
        <div key={stat.label} className="flex justify-between items-center">
          <span className="text-sm text-gray-600">{stat.label}</span>
          <span className={`text-lg font-semibold ${stat.colorClass}`}>
            {stat.value}
          </span>
        </div>
      ))}
    </div>
  );
}
