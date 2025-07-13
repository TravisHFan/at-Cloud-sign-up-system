import { useState, useEffect } from "react";
import { StatsLoadingState } from "../ui/LoadingStates";
import { eventService } from "../../services/api";

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
      // Fetch events from backend
      const response = await eventService.getEvents();
      const allEvents = response.events; // Extract events array from paginated response

      // Filter upcoming and completed events
      const now = new Date();
      const upcomingEvents = allEvents.filter((event: any) => {
        const eventDate = new Date(event.date);
        return eventDate >= now && event.status !== "cancelled";
      });

      const completedEvents = allEvents.filter((event: any) => {
        const eventDate = new Date(event.date);
        return eventDate < now && event.status === "completed";
      });

      const totalEvents = upcomingEvents.length + completedEvents.length;

      // Calculate total signups across all upcoming events
      const totalSignups = upcomingEvents.reduce(
        (total: number, event: any) => total + (event.signedUp || 0),
        0
      );

      // Calculate total slots available
      const totalSlots = upcomingEvents.reduce(
        (total: number, event: any) => total + (event.totalSlots || 0),
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
