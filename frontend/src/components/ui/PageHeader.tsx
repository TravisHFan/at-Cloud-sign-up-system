import React from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  breadcrumb?: React.ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  action,
  breadcrumb,
}: PageHeaderProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {breadcrumb && <div className="mb-4">{breadcrumb}</div>}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-gray-600 mt-1">{subtitle}</p>}
        </div>

        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  );
}
