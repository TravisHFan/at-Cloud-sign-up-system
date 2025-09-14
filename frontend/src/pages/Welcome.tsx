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
import { getLoadingSkeletonClass } from "../utils/uiUtils";

export default function Welcome() {
  const { currentUser } = useAuth();

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <WelcomeHeader />

      {/* Our Vision & Mission Card */}
      <DashboardCard
        title="Our Vision & Mission"
        icon={<Icon name="tag" className="text-blue-500" />}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0">
          <div className="flex-1">
            <p className="text-gray-600 mb-2">
              The vision of @Cloud is to celebrate and expand God’s kingdom &
              victories in the marketplace. Our mission is to call and equip
              Christian leaders to make an impact in the marketplace. Our
              objectives are to plant Marketplace Churches inside companies, and
              to setup the Marketplace Manger – an incubator facility to enable
              perspective Kingdom-minded entrepreneurs to receive advice and
              mentorship from experienced coaches.
            </p>
            <p className="text-sm text-gray-500">
              Discover opportunities for collaboration, spiritual growth, and
              business development through our comprehensive platform and
              community initiatives.
            </p>
          </div>
          <div className="flex justify-center md:justify-end">
            <a
              href="https://at-cloud.biz/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md transition-colors duration-200 flex items-center justify-center">
                <svg
                  className="mr-2 w-4 h-4 text-white flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                <span className="whitespace-nowrap">Visit @Cloud Website</span>
              </Button>
            </a>
          </div>
        </div>
      </DashboardCard>

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
    // Skeleton loading state (3 placeholder event cards)
    return (
      <div className="space-y-3" data-testid="upcoming-events-skeleton">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="p-3 rounded-lg border border-gray-200 bg-white/60 backdrop-blur-sm animate-pulse"
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`${getLoadingSkeletonClass("text")} w-2/3`}></div>
              <div className={`${getLoadingSkeletonClass("text")} w-10`}></div>
            </div>
            <div className={`${getLoadingSkeletonClass("text")} w-5/6`}></div>
          </div>
        ))}
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
                      event.endDate
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
