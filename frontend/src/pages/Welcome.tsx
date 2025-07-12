import {
  DashboardCard,
  QuickActionsCard,
  MinistryStatsCard,
  WelcomeHeader,
  GettingStartedSection,
  Icon,
} from "../components/common";
import { Button } from "../components/ui";
import { useNavigate } from "react-router-dom";
import { mockUpcomingEventsDynamic } from "../data/mockEventData";
import { formatEventDate, formatEventTime } from "../utils/eventStatsUtils";

export default function Welcome() {
  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <WelcomeHeader />

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

        <DashboardCard
          title="Ministry Stats"
          icon={<Icon name="bar-chart" className="text-orange-500" />}
        >
          <MinistryStatsCard />
        </DashboardCard>
      </div>

      {/* Getting Started Section */}
      <GettingStartedSection />
    </div>
  );
}

// Simple Upcoming Events Card Component
function UpcomingEventsCard() {
  const navigate = useNavigate();

  // Get the next 3 upcoming events
  const upcomingEvents = mockUpcomingEventsDynamic.slice(0, 3);

  // Function to calculate days until event
  const getDaysUntilEvent = (eventDate: string): string => {
    const now = new Date();
    const event = new Date(eventDate);
    const diffTime = event.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

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
            <div
              key={event.id}
              className={`flex items-center justify-between p-3 ${colors.bg} rounded-lg border ${colors.border}`}
            >
              <div className="flex items-center space-x-3">
                <div className={`w-2 h-2 ${colors.dot} rounded-full`}></div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {event.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatEventDate(event.date)} •{" "}
                    {formatEventTime(event.time)}
                  </p>
                </div>
              </div>
              <span className={`text-xs ${colors.text} font-medium`}>
                {daysUntil}
              </span>
            </div>
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
