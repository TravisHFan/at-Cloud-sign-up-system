import { useEventList } from "../hooks/useEventList";
import { mockPassedEventsDynamic } from "../data/mockEventData";
import EventStatsCards from "../components/events/EventStatsCards";
import EventListItem from "../components/events/EventListItem";
import { useState } from "react";
import toast from "react-hot-toast";

export default function PassedEvents() {
  const [currentUserRole] = useState<
    "Super Admin" | "Administrator" | "Leader" | "Participant"
  >("Super Admin"); // Replace with auth context later
  const [currentUserId] = useState<number>(1); // Replace with auth context later
  const {
    events,
    stats,
    searchTerm,
    setSearchTerm,
    sortBy,
    sortOrder,
    handleSort,
    handleSignUp,
    handleViewDetails,
  } = useEventList({
    events: mockPassedEventsDynamic,
    type: "passed",
  });

  // Check if current user can delete events
  const canDeleteEvent = (event: any) => {
    return (
      currentUserRole === "Super Admin" ||
      currentUserRole === "Administrator" ||
      (currentUserRole === "Leader" && event.createdBy === currentUserId)
    );
  };

  // Handle event deletion
  const handleDeleteEvent = async (eventId: number) => {
    try {
      console.log(`Deleting event ${eventId}`);
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      toast.success("Event has been permanently deleted.");
      // In real app, you would refetch the events or update the state
    } catch (error) {
      console.error("Error deleting event:", error);
      toast.error("Failed to delete event. Please try again.");
    }
  };

  // Handle event cancellation
  const handleCancelEvent = async (eventId: number) => {
    try {
      console.log(`Cancelling event ${eventId}`);
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      toast.success("Event has been cancelled.");
      // In real app, you would refetch the events or update the state
    } catch (error) {
      console.error("Error cancelling event:", error);
      toast.error("Failed to cancel event. Please try again.");
    }
  };

  const getSortIcon = (field: "date" | "title" | "organizer") => {
    if (sortBy !== field) {
      return (
        <svg
          className="w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
          />
        </svg>
      );
    }

    return sortOrder === "asc" ? (
      <svg
        className="w-4 h-4 text-blue-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 15l7-7 7 7"
        />
      </svg>
    ) : (
      <svg
        className="w-4 h-4 text-blue-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Past Events</h1>
        <p className="text-gray-600">
          Review completed ministry events and their attendance records.
        </p>
      </div>

      {/* Statistics Cards */}
      <EventStatsCards stats={stats} type="passed" />

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder="Search past events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg
                className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleSort("date")}
              className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-md transition-colors ${
                sortBy === "date"
                  ? "bg-blue-50 border-blue-300 text-blue-700"
                  : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              Date {getSortIcon("date")}
            </button>
            <button
              onClick={() => handleSort("title")}
              className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-md transition-colors ${
                sortBy === "title"
                  ? "bg-blue-50 border-blue-300 text-blue-700"
                  : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              Title {getSortIcon("title")}
            </button>
            <button
              onClick={() => handleSort("organizer")}
              className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-md transition-colors ${
                sortBy === "organizer"
                  ? "bg-blue-50 border-blue-300 text-blue-700"
                  : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              Organizer {getSortIcon("organizer")}
            </button>
          </div>
        </div>

        {/* Results Count */}
        <p className="text-sm text-gray-600">
          Showing {events.length} of {mockPassedEventsDynamic.length} events
        </p>
      </div>

      {/* Events List */}
      <div className="space-y-4">
        {events.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 mb-4"
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No events found
            </h3>
            <p className="text-gray-600">
              {searchTerm
                ? "Try adjusting your search terms."
                : "No past events available."}
            </p>
          </div>
        ) : (
          events.map((event) => (
            <EventListItem
              key={event.id}
              event={event}
              type="passed"
              onSignUp={handleSignUp}
              onViewDetails={handleViewDetails}
              onDelete={handleDeleteEvent}
              onCancel={handleCancelEvent}
              canDelete={canDeleteEvent(event)}
            />
          ))
        )}
      </div>
    </div>
  );
}
