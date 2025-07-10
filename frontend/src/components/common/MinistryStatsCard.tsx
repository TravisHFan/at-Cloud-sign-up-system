interface StatItem {
  label: string;
  value: string | number;
  colorClass: string;
}

const ministryStats: StatItem[] = [
  {
    label: "Total Events",
    value: 0,
    colorClass: "text-gray-900",
  },
  {
    label: "Upcoming Events",
    value: 0,
    colorClass: "text-blue-600",
  },
  {
    label: "Completed Events",
    value: 0,
    colorClass: "text-green-600",
  },
];

export default function MinistryStatsCard() {
  return (
    <div className="space-y-3">
      {ministryStats.map((stat) => (
        <div key={stat.label} className="flex justify-between items-center">
          <span className="text-sm text-gray-600">{stat.label}</span>
          <span className={`text-lg font-semibold ${stat.colorClass}`}>
            {stat.value}
          </span>
        </div>
      ))}
    </div>
  );
}