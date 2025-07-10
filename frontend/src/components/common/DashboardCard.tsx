import type { ReactNode } from "react";

interface DashboardCardProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}

export default function DashboardCard({
  title,
  icon,
  children,
}: DashboardCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {icon}
      </div>
      {children}
    </div>
  );
}
