interface QuickAction {
  label: string;
  href: string;
  colorClass: string;
}

const quickActions: QuickAction[] = [
  {
    label: "Create New Event",
    href: "/dashboard/new-event",
    colorClass: "bg-blue-50 text-blue-700 hover:bg-blue-100",
  },
  {
    label: "View Upcoming Events",
    href: "/dashboard/upcoming",
    colorClass: "bg-green-50 text-green-700 hover:bg-green-100",
  },
  {
    label: "Update Profile",
    href: "/dashboard/profile",
    colorClass: "bg-purple-50 text-purple-700 hover:bg-purple-100",
  },
];

export default function QuickActionsCard() {
  return (
    <div className="space-y-3">
      {quickActions.map((action) => (
        <a
          key={action.label}
          href={action.href}
          className={`block w-full text-left px-4 py-2 rounded-md transition-colors ${action.colorClass}`}
        >
          {action.label}
        </a>
      ))}
    </div>
  );
}