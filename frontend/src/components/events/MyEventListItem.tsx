import {
  formatEventDate,
  formatEventTime,
  safeFormatDate,
} from "../../utils/eventStatsUtils";
import { Badge } from "../ui";
import { useNavigate } from "react-router-dom";
import type {
  MyEventItemData,
  MyEventRegistration,
} from "../../types/myEvents";

interface MyEventListItemProps {
  item: MyEventItemData;
}

export default function MyEventListItem({ item }: MyEventListItemProps) {
  const navigate = useNavigate();

  const getStatusBadges = (
    registrations: MyEventRegistration[],
    isPassedEvent: boolean
  ) => {
    if (isPassedEvent) {
      // For passed events, show individual status badges for each role
      return registrations.map((reg, index) => {
        let badgeVariant: "success" | "error" | "warning" | "neutral" | "info" =
          "neutral";
        let badgeText = "";

        if (reg.status === "attended") {
          badgeVariant = "success";
          badgeText = "Attended";
        } else if (reg.status === "no_show") {
          badgeVariant = "error";
          badgeText = "No Show";
        } else {
          badgeVariant = "neutral";
          badgeText = "Completed";
        }

        return (
          <Badge key={`${reg.id}-${index}`} variant={badgeVariant}>
            {badgeText}
          </Badge>
        );
      });
    } else {
      // For upcoming events, show a single badge with role count
      const activeRoles = registrations.filter(
        (reg) => reg.status === "active"
      );
      const waitlistedRoles = registrations.filter(
        (reg) => reg.status === "waitlisted"
      );

      const badges = [];

      if (activeRoles.length > 0) {
        const roleText =
          activeRoles.length === 1
            ? "1 Role Registered"
            : `${activeRoles.length} Roles Registered`;
        badges.push(
          <Badge key="active-roles" variant="success">
            {roleText}
          </Badge>
        );
      }

      if (waitlistedRoles.length > 0) {
        const waitlistText =
          waitlistedRoles.length === 1
            ? "1 Role Waitlisted"
            : `${waitlistedRoles.length} Roles Waitlisted`;
        badges.push(
          <Badge key="waitlisted-roles" variant="warning">
            {waitlistText}
          </Badge>
        );
      }

      return badges;
    }
  };

  const getEventTypeBadge = (eventStatus: string) => {
    if (eventStatus === "upcoming") {
      return <Badge variant="info">Upcoming</Badge>;
    }
    return <Badge variant="neutral">Passed</Badge>;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {item.event.title}
        </h3>
        <div className="flex items-center space-x-2">
          {getEventTypeBadge(item.eventStatus)}
          <div className="flex gap-2">
            {getStatusBadges(item.registrations, item.isPassedEvent)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4 text-sm text-gray-600">
        <div className="flex items-center">
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          {formatEventDate(item.event.date)}
        </div>
        <div className="flex items-center">
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {formatEventTime(item.event.time)}
          {item.event.endTime && ` - ${formatEventTime(item.event.endTime)}`}
        </div>
        <div className="flex items-center">
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          {item.event.location}
        </div>
        <div className="flex items-center">
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          {item.event.organizer}
        </div>
      </div>

      {/* Additional Registration Details */}
      <div className="mb-4 text-sm text-gray-600">
        <div className="flex items-center mb-2">
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0H8m8 0v2a2 2 0 002 2v8a2 2 0 01-2 2H8a2 2 0 01-2-2v-8a2 2 0 012-2V6"
            />
          </svg>
          <span>
            Role(s):{" "}
            <strong>
              {item.registrations.map((reg) => reg.roleName).join(", ")}
            </strong>
          </span>
        </div>
        <div className="flex items-center">
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          First Registered:{" "}
          {safeFormatDate(
            new Date(
              Math.min(
                ...item.registrations.map((reg) =>
                  new Date(reg.registrationDate).getTime()
                )
              )
            )
              .toISOString()
              .split("T")[0] // Convert to YYYY-MM-DD format first
          )}
        </div>
      </div>

      {/* Notes */}
      {item.registrations.some((reg) => reg.notes) && (
        <div className="mb-4 text-sm text-gray-600">
          <div className="font-medium mb-1">Notes:</div>
          {item.registrations
            .filter((reg) => reg.notes)
            .map((reg, index) => (
              <div key={index} className="ml-4">
                • {reg.roleName}: {reg.notes}
              </div>
            ))}
        </div>
      )}

      {/* Special Requirements */}
      {item.registrations.some((reg) => reg.specialRequirements) && (
        <div className="mb-4 text-sm text-gray-600">
          <div className="font-medium mb-1">Special Requirements:</div>
          {item.registrations
            .filter((reg) => reg.specialRequirements)
            .map((reg, index) => (
              <div key={index} className="ml-4">
                • {reg.roleName}: {reg.specialRequirements}
              </div>
            ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          <span>
            {item.event.type} • {item.event.format}
          </span>
        </div>
        <button
          onClick={() => navigate(`/dashboard/event/${item.event.id}`)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium transition-colors"
        >
          View Details
        </button>
      </div>
    </div>
  );
}
