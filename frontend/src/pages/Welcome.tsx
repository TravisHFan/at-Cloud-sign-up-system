import DashboardCard from "../components/DashboardCard";
import QuickActionsCard from "../components/QuickActionsCard";
import RecentActivityCard from "../components/RecentActivityCard";
import MinistryStatsCard from "../components/MinistryStatsCard";
import WelcomeHeader from "../components/WelcomeHeader";
import GettingStartedSection from "../components/GettingStartedSection";
import Icon from "../components/Icon";

export default function Welcome() {
  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <WelcomeHeader />

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <DashboardCard
          title="Quick Actions"
          icon={<Icon name="lightning" className="text-blue-500" />}
        >
          <QuickActionsCard />
        </DashboardCard>

        <DashboardCard
          title="Recent Activity"
          icon={<Icon name="chart-bar" className="text-green-500" />}
        >
          <RecentActivityCard />
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
