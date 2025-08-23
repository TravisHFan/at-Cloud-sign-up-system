import {
  DashboardCard,
  QuickActionsCard,
  MinistryStatsCard,
  WelcomeHeader,
  GettingStartedSection,
  Icon,
} from "../components/common";
import { Button } from "../components/ui";
import { Link, useNavigate } from "react-router-dom";
import { useEvents } from "../hooks/useEventsApi";
import { useAuth } from "../hooks/useAuth";
import { formatEventDateTimeRangeInViewerTZ } from "../utils/eventStatsUtils";

export default function Welcome() {
  const { currentUser } = useAuth();

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <WelcomeHeader />

      {/* Dashboard Cards */}
      <div
        className={`grid grid-cols-1 gap-6 ${
          currentUser?.role === "Participant"
            ? "md:grid-cols-2" // 2 columns for Participants (no Ministry Stats)
            : "md:grid-cols-2 lg:grid-cols-3" // 3 columns for other roles
        }`}
      >
        <DashboardCard
          title="Quick Actions"
          icon={<Icon name="lightning" className="text-yellow-500" />}
        >
          <QuickActionsCard />
        </DashboardCard>

        <DashboardCard
          title="Upcoming Events"
          icon={<Icon name="calendar" className="text-blue-500" />}
        >
          <UpcomingEventsCard />
        </DashboardCard>

        {/* Only show Ministry Stats for non-Participant roles */}
        {currentUser?.role !== "Participant" && (
          <DashboardCard
            title="Ministry Stats"
            icon={<Icon name="bar-chart" className="text-orange-500" />}
          >
            <MinistryStatsCard />
          </DashboardCard>
        )}
      </div>

      {/* Getting Started Section */}
      <GettingStartedSection />
    </div>
  );
}

// Simple Upcoming Events Card Component
function UpcomingEventsCard() {
  const navigate = useNavigate();
  const { events, loading, error } = useEvents({
    status: "upcoming",
    pageSize: 3, // Only get the first 3 events
  });

  // Get the next 3 upcoming events
  const upcomingEvents = events.slice(0, 3);

  // Function to calculate days until event
  const getDaysUntilEvent = (eventDate: string): string => {
    const now = new Date();

    // Parse date string properly to avoid timezone issues
    // eventDate is in format "YYYY-MM-DD", so we need to parse it as local date
    const [year, month, day] = eventDate
      .split("-")
      .map((num) => parseInt(num, 10));
    const event = new Date(year, month - 1, day); // month is 0-indexed in JavaScript

    // Set both dates to start of day to ignore time components
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const eventStart = new Date(
      event.getFullYear(),
      event.getMonth(),
      event.getDate()
    );

    const diffTime = eventStart.getTime() - todayStart.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays < 7) return `${diffDays} days`;
    if (diffDays < 14) return "1 week";
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks`;
    return `${Math.floor(diffDays / 30)} month${
      Math.floor(diffDays / 30) > 1 ? "s" : ""
    }`;
  };

  // Color schemes for events
  const colorSchemes = [
    {
      bg: "bg-blue-50",
      border: "border-blue-200",
      dot: "bg-blue-500",
      text: "text-blue-600",
    },
    {
      bg: "bg-green-50",
      border: "border-green-200",
      dot: "bg-green-500",
      text: "text-green-600",
    },
    {
      bg: "bg-purple-50",
      border: "border-purple-200",
      dot: "bg-purple-500",
      text: "text-purple-600",
    },
  ];

  if (loading) {
    return (
      <div className="text-center py-6">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <span className="text-sm text-gray-500">Loading events...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-6">
        <div className="text-red-400 text-4xl mb-2">⚠️</div>
        <span className="text-sm text-red-600">Failed to load events</span>
        <p className="text-xs text-red-400 mt-1">{error}</p>
      </div>
    );
  }

  if (upcomingEvents.length === 0) {
    return (
      <div className="text-center py-6">
        <div className="text-gray-400 text-4xl mb-2">📅</div>
        <span className="text-sm text-gray-500">No upcoming events</span>
        <p className="text-xs text-gray-400 mt-1">
          Check back later for new events
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {upcomingEvents.map((event, index) => {
          const colors = colorSchemes[index % colorSchemes.length];
          const daysUntil = getDaysUntilEvent(event.date);

          return (
            <Link
              key={event.id}
              to={`/dashboard/event/${event.id}`}
              className="block rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <div
                className={`flex items-center justify-between p-3 ${colors.bg} rounded-lg border ${colors.border} hover:shadow-sm hover:bg-white/40 transition`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {event.title}
                  </p>
                  <p className="text-xs text-gray-500 truncate whitespace-nowrap">
                    {formatEventDateTimeRangeInViewerTZ(
                      event.date,
                      event.time,
                      event.endTime,
                      event.timeZone,
                      (event as any).endDate
                    )}
                  </p>
                </div>
                <span className={`text-xs ${colors.text} font-medium`}>
                  {daysUntil}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="pt-2 border-t border-gray-100">
        <Button
          variant="link"
          onClick={() => navigate("/dashboard/upcoming")}
          className="w-full text-sm"
        >
          View All Upcoming Events
        </Button>
      </div>
    </div>
  );
}
