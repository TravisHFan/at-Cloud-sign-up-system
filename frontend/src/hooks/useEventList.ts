import { useState, useMemo } from "react";
import toast from "react-hot-toast";
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
  const handleSignUp = async (eventId: number) => {
    try {
      console.log(`Signing up for event ${eventId}`);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast.success("Successfully signed up for the event!");
    } catch (error) {
      console.error("Error signing up:", error);
      toast.error("Failed to sign up. Please try again.");
    }
  };

  const handleViewDetails = (eventId: number) => {
    console.log(`Viewing details for event ${eventId}`);
    // Navigate to event details page or open modal
    toast("Event details feature coming soon!");
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
