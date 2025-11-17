import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { searchService } from "../../services/api";
import type { EventData } from "../../types/event";
import Icon from "../common/Icon";
import { formatEventDateTimeRangeInViewerTZ } from "../../utils/eventStatsUtils";

interface PopulateFromEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (event: EventData) => void;
  eventType: string;
}

export default function PopulateFromEventModal({
  isOpen,
  onClose,
  onSelect,
  eventType,
}: PopulateFromEventModalProps) {
  const [events, setEvents] = useState<EventData[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Search events with type filter
      // Using ".." which in regex matches any 2 characters - effectively returns all events
      // Combined with type filter, this gets all events of the specified type
      const response = await searchService.searchEvents("..", {
        type: eventType, // Backend expects 'type', not 'eventType'
      });

      // Check if response has results
      if (!response || !response.results) {
        console.error("Invalid response structure:", response);
        setError("Failed to load events: Invalid response from server");
        setEvents([]);
        setFilteredEvents([]);
        return;
      }

      // Filter events that have roles defined
      const eventsWithRoles = response.results.filter(
        (event) => event.roles && event.roles.length > 0
      );

      setEvents(eventsWithRoles);
      setFilteredEvents(eventsWithRoles);
    } catch (err) {
      console.error("Failed to load events:", err);
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, [eventType]);

  useEffect(() => {
    if (isOpen && eventType) {
      loadEvents();
    }
  }, [isOpen, eventType, loadEvents]);

  useEffect(() => {
    // Filter events based on search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filtered = events.filter((event) =>
        event.title.toLowerCase().includes(query)
      );
      setFilteredEvents(filtered);
    } else {
      setFilteredEvents(events);
    }
    setCurrentPage(1); // Reset to first page when search changes
  }, [searchQuery, events]);

  const handleSelect = (event: EventData) => {
    onSelect(event);
    handleClose();
  };

  const handleClose = () => {
    setSearchQuery("");
    setCurrentPage(1);
    onClose();
  };

  // Pagination
  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentEvents = filteredEvents.slice(startIndex, endIndex);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Populate from Existing Event
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <Icon name="x-circle" className="w-6 h-6" />
            </button>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Select an event to copy its role configuration to this template.
            Only showing <span className="font-medium">{eventType}</span> events
            with roles.
          </p>

          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search events by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500">Loading events...</div>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
              <button
                onClick={loadEvents}
                className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Try Again
              </button>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-12">
              <Icon
                name="calendar"
                className="w-12 h-12 text-gray-400 mx-auto mb-3"
              />
              <p className="text-gray-600">
                {searchQuery
                  ? "No events found matching your search"
                  : `No ${eventType} events with roles found`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {currentEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => handleSelect(event)}
                  className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 mb-1">
                        {event.title}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Icon name="calendar" className="w-4 h-4" />
                          <span>
                            {formatEventDateTimeRangeInViewerTZ(
                              event.date,
                              event.time,
                              event.endTime,
                              event.timeZone,
                              event.endDate
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Icon name="user" className="w-4 h-4" />
                          <span>
                            {event.roles.length} role
                            {event.roles.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Icon
                      name="arrow-right"
                      className="w-6 h-6 text-gray-400 flex-shrink-0"
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer with Pagination */}
        {filteredEvents.length > itemsPerPage && (
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {startIndex + 1}-
                {Math.min(endIndex, filteredEvents.length)} of{" "}
                {filteredEvents.length} events
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cancel Button */}
        <div className="p-6 border-t border-gray-200">
          <div className="flex justify-end">
            <button
              onClick={handleClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
