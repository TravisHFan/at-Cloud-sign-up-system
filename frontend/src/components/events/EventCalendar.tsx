import { useState, useMemo } from "react";
import type { EventData } from "../../types/event";
import type { MyEventItemData } from "../../types/myEvents";

interface EventCalendarProps {
  events: EventData[] | MyEventItemData[];
  type: "upcoming" | "my-events";
  onEventClick?: (eventId: string) => void;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: (EventData | MyEventItemData)[];
}

export default function EventCalendar({
  events,
  type,
  onEventClick,
}: EventCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Calculate calendar data
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Get first day of the month and calculate starting day of calendar
    const firstDayOfMonth = new Date(year, month, 1);
    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday

    // Calculate total days to show (6 weeks)
    const totalDays = 42;
    const startDate = new Date(firstDayOfMonth);
    startDate.setDate(startDate.getDate() - startingDayOfWeek);

    const days: CalendarDay[] = [];

    for (let i = 0; i < totalDays; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);

      const isCurrentMonth = date.getMonth() === month;
      const isToday = date.getTime() === today.getTime();

      // Filter events for this date
      const dayEvents = events.filter((event) => {
        let eventDate: string;

        if (type === "my-events") {
          // For MyEventItemData
          eventDate = (event as MyEventItemData).event.date;
        } else {
          // For EventData
          eventDate = (event as EventData).date;
        }

        // Parse event date safely
        const eventDateObj = new Date(eventDate + "T00:00:00"); // Add time to avoid timezone issues
        eventDateObj.setHours(0, 0, 0, 0);

        return eventDateObj.getTime() === date.getTime();
      });

      days.push({
        date,
        isCurrentMonth,
        isToday,
        events: dayEvents,
      });
    }

    return days;
  }, [currentDate, events, type, today]);

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      if (direction === "prev") {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getEventTitle = (event: EventData | MyEventItemData): string => {
    if (type === "my-events") {
      return (event as MyEventItemData).event.title;
    }
    return (event as EventData).title;
  };

  const getEventId = (event: EventData | MyEventItemData): string => {
    if (type === "my-events") {
      return (event as MyEventItemData).event.id;
    }
    return (event as EventData).id;
  };

  const getEventType = (event: EventData | MyEventItemData): string => {
    if (type === "my-events") {
      return (event as MyEventItemData).event.type;
    }
    return (event as EventData).type;
  };

  // Get color classes based on event type
  const getEventColorClasses = (event: EventData | MyEventItemData): string => {
    const eventType = getEventType(event);

    // Color mapping based on event type
    switch (eventType) {
      case "Effective Communication Workshop Series":
        return "bg-purple-100 text-purple-800 hover:bg-purple-200";
      case "Leadership Development":
        return "bg-indigo-100 text-indigo-800 hover:bg-indigo-200";
      case "Team Building":
        return "bg-emerald-100 text-emerald-800 hover:bg-emerald-200";
      case "Professional Development":
        return "bg-amber-100 text-amber-800 hover:bg-amber-200";
      case "Community Outreach":
        return "bg-rose-100 text-rose-800 hover:bg-rose-200";
      default:
        // Fallback to purple for unknown types
        return "bg-purple-100 text-purple-800 hover:bg-purple-200";
    }
  };

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Event Calendar</h2>
        <div className="flex items-center space-x-4">
          <button
            onClick={goToToday}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
          >
            Today
          </button>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigateMonth("prev")}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              aria-label="Previous month"
            >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <h3 className="text-lg font-medium text-gray-900 min-w-[160px] text-center">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h3>
            <button
              onClick={() => navigateMonth("next")}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              aria-label="Next month"
            >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Day Names Header */}
        {dayNames.map((day) => (
          <div
            key={day}
            className="p-2 text-center text-sm font-medium text-gray-700 bg-gray-50"
          >
            {day}
          </div>
        ))}

        {/* Calendar Days */}
        {calendarData.map((day, index) => (
          <div
            key={index}
            className={`min-h-[80px] p-1 border border-gray-100 ${
              !day.isCurrentMonth
                ? "bg-gray-50 text-gray-400"
                : day.isToday
                ? "bg-blue-50 border-blue-200"
                : "bg-white hover:bg-gray-50"
            } transition-colors`}
          >
            {/* Date Number */}
            <div
              className={`text-sm font-medium mb-1 ${
                day.isToday
                  ? "text-blue-700"
                  : day.isCurrentMonth
                  ? "text-gray-900"
                  : "text-gray-400"
              }`}
            >
              {day.date.getDate()}
            </div>

            {/* Events for this day */}
            <div className="space-y-1">
              {day.events.slice(0, 2).map((event, eventIndex) => (
                <div
                  key={eventIndex}
                  onClick={() => onEventClick?.(getEventId(event))}
                  className={`text-xs p-1 rounded cursor-pointer truncate ${getEventColorClasses(
                    event
                  )} transition-colors`}
                  title={getEventTitle(event)}
                >
                  {getEventTitle(event)}
                </div>
              ))}

              {/* Show count if more than 2 events */}
              {day.events.length > 2 && (
                <div className="text-xs text-gray-500 px-1">
                  +{day.events.length - 2} more
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Calendar Legend */}
      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-50 border border-blue-200 rounded"></div>
            <span>Today</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-purple-100 rounded"></div>
            <span>Effective Communication</span>
          </div>
        </div>
        <div className="text-xs">Click on events to view details</div>
      </div>
    </div>
  );
}
