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

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                Bible Study Series
              </p>
              <p className="text-xs text-gray-500">March 15, 2025 • 7:00 PM</p>
            </div>
          </div>
          <span className="text-xs text-blue-600 font-medium">Tomorrow</span>
        </div>

        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                Youth Ministry
              </p>
              <p className="text-xs text-gray-500">March 18, 2025 • 6:30 PM</p>
            </div>
          </div>
          <span className="text-xs text-green-600 font-medium">4 days</span>
        </div>

        <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                Community Service
              </p>
              <p className="text-xs text-gray-500">March 22, 2025 • 9:00 AM</p>
            </div>
          </div>
          <span className="text-xs text-purple-600 font-medium">1 week</span>
        </div>
      </div>

      <div className="pt-2 border-t border-gray-100">
        <Button
          variant="link"
          onClick={() => navigate("/dashboard/events")}
          className="w-full text-sm"
        >
          View All Events
        </Button>
      </div>
    </div>
  );
}
