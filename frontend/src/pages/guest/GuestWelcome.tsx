import { useNavigate } from "react-router-dom";
import { useCurrentTime } from "../../hooks/useCurrentTime";
import { useEvents } from "../../hooks/useEventsApi";
import { formatEventDateTimeRangeInViewerTZ } from "../../utils/eventStatsUtils";
import { Button } from "../../components/ui";
import { DashboardCard, Icon } from "../../components/common";

export default function GuestWelcome() {
  const { greeting, formattedDate } = useCurrentTime();

  return (
    <div className="space-y-6">
      {/* Custom Guest Welcome Header */}
      <GuestWelcomeHeader greeting={greeting} formattedDate={formattedDate} />

      {/* Guest Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DashboardCard
          title="Upcoming Events"
          icon={<Icon name="calendar" className="text-blue-500" />}
        >
          <GuestUpcomingEventsCard />
        </DashboardCard>

        <DashboardCard
          title="Join Our Community"
          icon={<Icon name="user" className="text-purple-500" />}
        >
          <SignUpEncouragementCard />
        </DashboardCard>
      </div>

      {/* Guest Getting Started Section */}
      <GuestGettingStartedSection />
    </div>
  );
}

// Custom Guest Welcome Header
function GuestWelcomeHeader({
  greeting,
  formattedDate,
}: {
  greeting: string;
  formattedDate: string;
}) {
  const navigate = useNavigate();

  return (
    <div className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 rounded-xl p-8 text-white overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-black bg-opacity-10"></div>
      <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white bg-opacity-10 rounded-full"></div>
      <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-32 h-32 bg-white bg-opacity-5 rounded-full"></div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-white to-blue-100 bg-clip-text">
              {greeting} Guest, Welcome to @Cloud Events! 🌟
            </h1>
            <p className="text-blue-100 text-lg">{formattedDate}</p>
          </div>
          <div className="hidden lg:block">
            <div className="text-6xl opacity-20">👋</div>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-lg leading-relaxed">
            You're exploring the{" "}
            <span className="font-semibold text-yellow-300">
              @Cloud Marketplace Ministry Events
            </span>{" "}
            as a guest. Discover amazing events, connect with our vibrant
            community, and grow your ministry journey!
          </p>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => navigate("/signup")}
              className="bg-green-600 text-white hover:bg-green-700 font-semibold px-6 py-2 rounded-lg transition-all duration-200 transform hover:scale-105"
            >
              ✨ Sign Up for Full Access
            </Button>
            <Button
              onClick={() => navigate("/login")}
              variant="outline"
              className="border-blue-400 text-blue-100 hover:bg-blue-600 hover:text-white font-semibold px-6 py-2 rounded-lg transition-all duration-200"
            >
              🔑 Login
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Guest-specific Upcoming Events Card
function GuestUpcomingEventsCard() {
  const navigate = useNavigate();
  const { events, loading, error } = useEvents({
    status: "upcoming",
    pageSize: 3,
  });

  const upcomingEvents = events.slice(0, 3);

  const getDaysUntilEvent = (eventDate: string): string => {
    const now = new Date();
    const [year, month, day] = eventDate
      .split("-")
      .map((num) => parseInt(num, 10));
    const event = new Date(year, month - 1, day);

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
      <div className="text-center py-8">
        <div className="text-gray-400 text-4xl mb-3">📅</div>
        <span className="text-sm text-gray-500 block mb-2">
          No upcoming events
        </span>
        <p className="text-xs text-gray-400">
          Check back later for amazing new events!
        </p>
        <div className="mt-4">
          <Button
            variant="outline"
            onClick={() => navigate("/signup")}
            className="text-sm"
          >
            📧 Get notified of new events
          </Button>
        </div>
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
              className={`flex items-center justify-between p-3 ${colors.bg} rounded-lg border ${colors.border} hover:shadow-md transition-shadow cursor-pointer`}
              onClick={() => navigate(`/guest-dashboard/upcoming`)}
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
          );
        })}
      </div>

      <div className="pt-2 border-t border-gray-100 space-y-2">
        <Button
          variant="link"
          onClick={() => navigate("/guest-dashboard/upcoming")}
          className="w-full text-sm"
        >
          🔍 Browse All Events
        </Button>
        <p className="text-xs text-center text-gray-500">
          💡 <span className="font-medium">Sign up</span> to register for events
          and connect with organizers!
        </p>
      </div>
    </div>
  );
}

// Sign Up Encouragement Card
function SignUpEncouragementCard() {
  const navigate = useNavigate();

  const benefits = [
    { icon: "🎟️", text: "Register for events", color: "text-blue-600" },
    { icon: "💬", text: "Connect with community", color: "text-green-600" },
    { icon: "📧", text: "Get event notifications", color: "text-purple-600" },
    {
      icon: "🎯",
      text: "Personalized recommendations",
      color: "text-orange-600",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <div className="text-3xl mb-2">🚀</div>
        <h3 className="font-semibold text-gray-900 mb-1">
          Unlock Your Full Potential
        </h3>
        <p className="text-sm text-gray-600">
          Join our community and get access to exclusive features!
        </p>
      </div>

      <div className="space-y-3">
        {benefits.map((benefit, index) => (
          <div
            key={index}
            className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <span className="text-lg">{benefit.icon}</span>
            <span className={`text-sm font-medium ${benefit.color}`}>
              {benefit.text}
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-3 pt-4 border-t border-gray-100">
        <Button
          onClick={() => navigate("/signup")}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 transform hover:scale-105"
        >
          ✨ Create Free Account
        </Button>

        <div className="text-center">
          <p className="text-xs text-gray-500 mb-2">Already have an account?</p>
          <Button
            variant="link"
            onClick={() => navigate("/login")}
            className="text-sm font-medium text-purple-600 hover:text-purple-700"
          >
            🔑 Sign In Here
          </Button>
        </div>
      </div>
    </div>
  );
}

// Guest Getting Started Section
function GuestGettingStartedSection() {
  const navigate = useNavigate();

  const steps = [
    {
      number: 1,
      title: "Explore Events",
      description:
        "Browse our upcoming events and discover amazing opportunities",
      icon: "🔍",
      action: () => navigate("/guest-dashboard/upcoming"),
      actionText: "Browse Events",
    },
    {
      number: 2,
      title: "Join the Community",
      description:
        "Create your free account to unlock all features and connect with others",
      icon: "👥",
      action: () => navigate("/signup"),
      actionText: "Sign Up Now",
    },
    {
      number: 3,
      title: "Start Participating",
      description:
        "Register for events, meet new people, and grow your ministry",
      icon: "🎯",
      action: () => navigate("/guest-dashboard/my-events"),
      actionText: "My Events",
    },
  ];

  return (
    <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          🌟 Get Started with @Cloud Events
        </h2>
        <p className="text-gray-600">
          Follow these simple steps to make the most of your visit
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {steps.map((step, index) => (
          <div
            key={index}
            className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center mb-4">
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">
                {step.number}
              </div>
              <div className="text-2xl">{step.icon}</div>
            </div>

            <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
            <p className="text-sm text-gray-600 mb-4">{step.description}</p>

            <Button
              onClick={step.action}
              variant="outline"
              className="w-full text-sm hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-colors"
            >
              {step.actionText}
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600 mb-3">
          Ready to dive deeper? Join thousands of community members already
          connected!
        </p>
        <div className="flex justify-center space-x-3">
          <Button
            onClick={() => navigate("/signup")}
            className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-semibold px-6 py-2 rounded-lg"
          >
            🎉 Join Now - It's Free!
          </Button>
        </div>
      </div>
    </div>
  );
}
