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
}

export function useEventList({ events, type }: UseEventListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "title" | "organizer">("date");
  const notification = useToastReplacement();
  const navigate = useNavigate();
  // Fix: Default sort order should be different for each type
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
    type === "upcoming" ? "asc" : "desc"
  );

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
        default:
          comparison = 0;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [filteredEvents, sortBy, sortOrder]);

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

  const handleSort = (field: "date" | "title" | "organizer") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      // Fix: Set appropriate default sort order based on field and type
      if (field === "date") {
        setSortOrder(type === "upcoming" ? "asc" : "desc");
      } else {
        setSortOrder("asc");
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
