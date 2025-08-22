import { useState, useMemo } from "react";
import type { EventData, EventStats } from "../types/event";
import {
  calculateUpcomingEventStats,
  calculatePassedEventStats,
} from "../utils/eventStatsUtils";

interface UseGuestEventListProps {
  events: EventData[];
  type: "upcoming" | "passed";
  onSignUp: (eventId: string) => void;
  onViewDetails: (eventId: string) => void;
}

export function useGuestEventList({
  events,
  type,
  onSignUp,
  onViewDetails,
}: UseGuestEventListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "title" | "organizer">("date");
  // Default sort order should be different for each type
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

  // Sort handler
  const handleSort = (field: "date" | "title" | "organizer") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  return {
    events: sortedEvents,
    stats,
    searchTerm,
    setSearchTerm,
    sortBy,
    sortOrder,
    handleSort,
    handleSignUp: onSignUp,
    handleViewDetails: onViewDetails,
  };
}
