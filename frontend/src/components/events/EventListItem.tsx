import type { EventData } from "../../types/event";
import { formatEventDate, formatEventTime } from "../../utils/eventStatsUtils";

interface EventListItemProps {
  event: EventData;
  type: "upcoming" | "passed";
  onSignUp?: (eventId: number) => void;
  onViewDetails?: (eventId: number) => void;
}

export default function EventListItem({
  event,
  type,
  onSignUp,
  onViewDetails,
}: EventListItemProps) {
  const getStatusBadge = () => {
    if (type === "passed") {
      return event.status === "completed" ? (
        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
          Completed
        </span>
      ) : (
        <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
          Cancelled
        </span>
      );
    }

    // For upcoming events, show availability
    const spotsLeft = event.totalSlots - event.signedUp;
    const isAlmostFull = spotsLeft <= 5 && spotsLeft > 0;
    const isFull = spotsLeft === 0;

    if (isFull) {
      return (
        <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
          Full
        </span>
      );
    }

    if (isAlmostFull) {
      return (
        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
          {spotsLeft} spots left
        </span>
      );
    }

    return (
      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
        Available
      </span>
    );
  };

  const getActionButton = () => {
    if (type === "passed") {
      return (
        <button
          onClick={() => onViewDetails?.(event.id)}
          className="px-4 py-2 text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 transition-colors"
        >
          View Details
        </button>
      );
    }

    const spotsLeft = event.totalSlots - event.signedUp;
    const isFull = spotsLeft === 0;

    return (
      <button
        onClick={() => onSignUp?.(event.id)}
        disabled={isFull}
        className={`px-4 py-2 rounded-md transition-colors ${
          isFull
            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
            : "bg-blue-600 text-white hover:bg-blue-700"
        }`}
      >
        {isFull ? "Full" : "Sign Up"}
      </button>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{event.title}</h3>
        {getStatusBadge()}
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
          {formatEventDate(event.date)}
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
          {formatEventTime(event.time)}
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
          {event.location}
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
          {event.organizer}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {type === "upcoming" ? (
            <span>
              {event.signedUp}/{event.totalSlots} signed up
            </span>
          ) : (
            <span>
              {event.attendees}/{event.signedUp} attended
            </span>
          )}
        </div>
        {getActionButton()}
      </div>
    </div>
  );
}
