import { useState, useEffect } from "react";
import { StatsLoadingState } from "../ui/LoadingStates";
import { analyticsService } from "../../services/api";

interface StatItem {
  label: string;
  value: string | number;
  colorClass: string;
}

export default function MinistryStatsCard() {
  const [ministryStats, setMinistryStats] = useState<StatItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Function to calculate real ministry statistics from backend data
  const calculateMinistryStats = async (): Promise<StatItem[]> => {
    try {
      // Fetch events with registration data from analytics API
      const response = await analyticsService.getEventAnalytics();
      const upcomingEvents = response.upcomingEvents || [];
      const completedEvents = response.completedEvents || [];

      const totalEvents = upcomingEvents.length + completedEvents.length;

      // Calculate total signups and slots from roles array
      let totalSignups = 0;
      let totalSlots = 0;

      upcomingEvents.forEach((event: any) => {
        if (event.roles && Array.isArray(event.roles)) {
          event.roles.forEach((role: any) => {
            // Add max participants to total slots
            totalSlots += role.maxParticipants || 0;

            // Count current signups for this role
            if (Array.isArray(role?.currentSignups)) {
              totalSignups += role.currentSignups.length;
            } else if (Array.isArray(role?.registrations)) {
              totalSignups += role.registrations.length;
            } else if (typeof role?.currentCount === "number") {
              totalSignups += role.currentCount;
            }
          });
        }
      });

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
    } catch (error) {
      console.error("Error calculating ministry stats:", error);
      // Return default stats on error
      return [
        { label: "Total Events", value: 0, colorClass: "text-gray-900" },
        { label: "Upcoming Events", value: 0, colorClass: "text-blue-600" },
        { label: "Total Signups", value: 0, colorClass: "text-green-600" },
        { label: "Available Spots", value: 0, colorClass: "text-orange-600" },
      ];
    }
  };

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        const stats = await calculateMinistryStats();
        setMinistryStats(stats);
      } catch (error) {
        console.error("Error loading ministry stats:", error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  if (loading) {
    return <StatsLoadingState count={4} />;
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
