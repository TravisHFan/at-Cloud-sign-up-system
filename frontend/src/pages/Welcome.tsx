import { useState, useEffect } from "react";
import GettingStartedStep from "../components/GettingStartedStep";
import DashboardCard from "../components/DashboardCard";
import QuickActionsCard from "../components/QuickActionsCard";
import RecentActivityCard from "../components/RecentActivityCard";
import MinistryStatsCard from "../components/MinistryStatsCard";
import WelcomeHeader from "../components/WelcomeHeader";
import Icon from "../components/Icon";

export default function Welcome() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const gettingStartedSteps = [
    {
      stepNumber: 1,
      title: "Complete Your Profile",
      description:
        "Add your personal information and ministry details to help others connect with you.",
      color: "blue" as const,
    },
    {
      stepNumber: 2,
      title: "Create Your First Event",
      description:
        "Share your ministry events with the @Cloud community and start building connections.",
      color: "green" as const,
    },
    {
      stepNumber: 3,
      title: "Explore Community Events",
      description:
        "Discover and participate in events created by other ministry leaders.",
      color: "purple" as const,
    },
    {
      stepNumber: 4,
      title: "Connect & Collaborate",
      description:
        "Build relationships with other ministry leaders and grow your impact together.",
      color: "orange" as const,
    },
  ];

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
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Getting Started with @Cloud
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {gettingStartedSteps.map((step) => (
            <GettingStartedStep
              key={step.stepNumber}
              stepNumber={step.stepNumber}
              title={step.title}
              description={step.description}
              color={step.color}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
