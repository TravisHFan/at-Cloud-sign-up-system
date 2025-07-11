import { useState } from "react";
// import { useAuth } from "../../hooks/useAuth"; // Uncomment when auth is fully implemented

interface QuickAction {
  label: string;
  href: string;
  colorClass: string;
  requiredRoles?: string[]; // Optional roles that can see this action
}

const quickActions: QuickAction[] = [
  {
    label: "Create New Event",
    href: "/dashboard/new-event",
    colorClass: "bg-blue-50 text-blue-700 hover:bg-blue-100",
    requiredRoles: ["Super Admin", "Administrator", "Leader"], // Only these roles can create events
  },
  {
    label: "View Upcoming Events",
    href: "/dashboard/upcoming",
    colorClass: "bg-green-50 text-green-700 hover:bg-green-100",
    // No requiredRoles means everyone can see this
  },
  {
    label: "Update Profile",
    href: "/dashboard/profile",
    colorClass: "bg-purple-50 text-purple-700 hover:bg-purple-100",
    // No requiredRoles means everyone can see this
  },
  {
    label: "Change Password",
    href: "/dashboard/change-password",
    colorClass: "bg-orange-50 text-orange-700 hover:bg-orange-100",
    // No requiredRoles means everyone can see this
  },
];

export default function QuickActionsCard() {
  // Mock current user role - this will come from auth context later
  // const { currentUser } = useAuth(); // Uncomment when auth is fully implemented
  // Change this value to test different roles: "Super Admin", "Administrator", "Leader", "Participant"
  const [currentUserRole] = useState<string>("Administrator"); // This will be: currentUser.role

  // Filter actions based on user role
  const visibleActions = quickActions.filter((action) => {
    if (!action.requiredRoles) return true; // Show to everyone if no role requirement
    return action.requiredRoles.includes(currentUserRole);
  });

  return (
    <div className="space-y-3">
      {visibleActions.map((action) => (
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
