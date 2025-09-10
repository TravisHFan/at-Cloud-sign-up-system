import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { MyEventItemData } from "../types/myEvents";

interface UseMyEventListProps {
  events: MyEventItemData[];
}

export function useMyEventList({ events }: UseMyEventListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "title" | "organizer">("date");
  // Default chronological (earliest to latest)
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [filter, setFilter] = useState<"all" | "upcoming" | "passed">("all");
  const navigate = useNavigate();

  // Filter events based on search term and filter type
  const filteredEvents = useMemo(() => {
    let filtered = events;

    // Filter by event timing
    if (filter === "upcoming") {
      filtered = filtered.filter((item) => !item.isPassedEvent);
    } else if (filter === "passed") {
      filtered = filtered.filter((item) => item.isPassedEvent);
    }

    // Only show events with at least one active registration
    filtered = filtered.filter((item) =>
      item.registrations.some((reg) => reg.status === "active")
    );

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (item) =>
          item.event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.event.organizer
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          item.event.location.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [events, searchTerm, filter]);

  // Sort events
  const sortedEvents = useMemo(() => {
    const sorted = [...filteredEvents].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "date":
          const dateTimeA = new Date(
            `${a.event.date}T${a.event.endTime || a.event.time}`
          );
          const dateTimeB = new Date(
            `${b.event.date}T${b.event.endTime || b.event.time}`
          );
          comparison = dateTimeA.getTime() - dateTimeB.getTime();
          break;
        case "title":
          comparison = a.event.title.localeCompare(b.event.title);
          break;
        case "organizer":
          comparison = a.event.organizer.localeCompare(b.event.organizer);
          break;
        default:
          comparison = 0;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [filteredEvents, sortBy, sortOrder]);

  const handleSort = (field: "date" | "title" | "organizer") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      // Set default sort order
      if (field === "date") {
        setSortOrder("asc"); // Earliest first for dates (chronological)
      } else {
        setSortOrder("asc"); // A-Z for text fields
      }
    }
  };

  const handleViewDetails = (eventId: string) => {
    navigate(`/dashboard/event/${eventId}`);
  };

  return {
    // Data
    events: sortedEvents,
    allEvents: events,

    // Search and filter state
    searchTerm,
    setSearchTerm,
    filter,
    setFilter,

    // Sort state
    sortBy,
    sortOrder,
    handleSort,

    // Actions
    handleViewDetails,
  };
}
