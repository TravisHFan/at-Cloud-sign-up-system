import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useToastReplacement } from "../contexts/NotificationModalContext";
import type { EventData, EventStats } from "../types/event";
import {
  calculateUpcomingEventStats,
  calculatePassedEventStats,
} from "../utils/eventStatsUtils";

interface UseEventListProps {
  events: EventData[];
  type: "upcoming" | "passed";
  controlledSort?: {
    sortBy: "date" | "title" | "organizer" | "type";
    sortOrder: "asc" | "desc";
    disableLocalSorting?: boolean; // when true, keep server order
    onSortChange?: (
      field: "date" | "title" | "organizer" | "type",
      order: "asc" | "desc"
    ) => void;
  };
}

export function useEventList({
  events,
  type,
  controlledSort,
}: UseEventListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  // Internal state only if not controlled
  const [internalSortBy, setInternalSortBy] = useState<
    "date" | "title" | "organizer" | "type"
  >("date");
  const [internalSortOrder, setInternalSortOrder] = useState<"asc" | "desc">(
    type === "upcoming" ? "asc" : "desc"
  );
  const notification = useToastReplacement();
  const navigate = useNavigate();

  const sortBy = controlledSort ? controlledSort.sortBy : internalSortBy;
  const sortOrder = controlledSort
    ? controlledSort.sortOrder
    : internalSortOrder;

  // Filter events based on search term
  const filteredEvents = useMemo(() => {
    if (!searchTerm) return events;

    return events.filter(
      (event) =>
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.organizer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.location.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [events, searchTerm]);

  // Sort events
  const sortedEvents = useMemo(() => {
    if (controlledSort?.disableLocalSorting) {
      // Preserve incoming server ordering except for search filtering
      return filteredEvents;
    }
    const sorted = [...filteredEvents].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "date":
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "organizer":
          comparison = a.organizer.localeCompare(b.organizer);
          break;
        case "type":
          comparison = (a.type || "").localeCompare(b.type || "");
          break;
        default:
          comparison = 0;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [filteredEvents, sortBy, sortOrder, controlledSort?.disableLocalSorting]);

  // Calculate statistics
  const stats: EventStats = useMemo(() => {
    if (type === "upcoming") {
      return calculateUpcomingEventStats(events);
    } else {
      return calculatePassedEventStats(events);
    }
  }, [events, type]);

  // Event actions
  const handleSignUp = async (eventId: string) => {
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      notification.success("You have successfully signed up for this event!", {
        title: "Event Signup Confirmed",
        autoCloseDelay: 4000,
        closeButtonText: "OK",
        actionButton: {
          text: "View My Events",
          onClick: () => {
            // Navigate to user's events
            window.location.href = "/my-events";
          },
          variant: "primary",
        },
      });
    } catch (error) {
      console.error("Error signing up:", error);
      notification.error(
        "Unable to complete your event signup. Please try again.",
        {
          title: "Signup Failed",
          actionButton: {
            text: "Retry Signup",
            onClick: () => handleSignUp(eventId),
            variant: "primary",
          },
        }
      );
    }
  };

  const handleViewDetails = (eventId: string) => {
    // Navigate to event details page
    navigate(`/dashboard/event/${eventId}`);
  };

  const handleSort = (field: "date" | "title" | "organizer" | "type") => {
    if (controlledSort?.onSortChange) {
      let nextOrder: "asc" | "desc";
      if (sortBy === field) {
        nextOrder = sortOrder === "asc" ? "desc" : "asc";
      } else {
        nextOrder =
          field === "date" ? (type === "upcoming" ? "asc" : "desc") : "asc";
      }
      controlledSort.onSortChange(field, nextOrder);
      return;
    }
    // Uncontrolled fallback
    if (sortBy === field) {
      setInternalSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setInternalSortBy(field);
      if (field === "date") {
        setInternalSortOrder(type === "upcoming" ? "asc" : "desc");
      } else {
        setInternalSortOrder("asc");
      }
    }
  };

  return {
    // Data
    events: sortedEvents,
    stats,

    // Search and filter state
    searchTerm,
    setSearchTerm,

    // Sort state
    sortBy,
    sortOrder,
    handleSort,

    // Actions
    handleSignUp,
    handleViewDetails,
  };
}
