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
          icon={
            <img 
              src="/marketing.svg" 
              alt="Marketing" 
              className="w-5 h-5" 
              style={{ filter: 'brightness(0) saturate(100%) invert(26%) sepia(94%) saturate(6338%) hue-rotate(212deg) brightness(99%) contrast(91%)' }}
            />
          }
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
