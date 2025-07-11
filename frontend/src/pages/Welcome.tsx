import {
  DashboardCard,
  QuickActionsCard,
  RecentActivityCard,
  MinistryStatsCard,
  WelcomeHeader,
  GettingStartedSection,
  Icon,
} from "../components/common";

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
