import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import MyEvents from "../../pages/MyEvents";
import type { MyEventItemData } from "../../types/myEvents";

const mockRefreshEvents = vi.fn();

const mockEventsData = [
  {
    event: {
      id: "evt1",
      title: "Past Event",
      date: "2025-10-01",
      endDate: null,
      time: "10:00",
      endTime: "12:00",
    },
    registration: {
      id: "reg1",
      role: "Participant",
      status: "confirmed",
    },
    isPassedEvent: true,
    eventStatus: "completed",
  },
  {
    event: {
      id: "evt2",
      title: "Upcoming Event",
      date: "2025-12-01",
      endDate: null,
      time: "14:00",
      endTime: "16:00",
    },
    registration: {
      id: "reg2",
      role: "Organizer",
      status: "confirmed",
    },
    isPassedEvent: false,
    eventStatus: "upcoming",
  },
];

vi.mock("../../hooks/useEventsApi", () => ({
  useUserEvents: () => ({
    events: mockEventsData,
    stats: {
      totalEvents: 2,
      upcomingEvents: 1,
      pastEvents: 1,
    },
    loading: false,
    error: null,
    refreshEvents: mockRefreshEvents,
    pagination: {
      currentPage: 1,
      totalPages: 1,
      totalEvents: 2,
      hasNext: false,
      hasPrev: false,
    },
  }),
}));

// Mock MyEventList component
vi.mock("../../components/events/MyEventList", () => ({
  default: ({
    events,
    stats,
    title,
    pagination,
    onPageChange,
  }: {
    events: MyEventItemData[];
    stats: { totalEvents: number; upcomingEvents: number; pastEvents: number };
    title: string;
    pagination?: { currentPage: number; totalPages: number };
    onPageChange?: (page: number) => void;
  }) => (
    <div data-testid="my-event-list">
      <h1>{title}</h1>
      <div data-testid="stats">
        Total: {stats.totalEvents}, Upcoming: {stats.upcomingEvents}, Past:{" "}
        {stats.pastEvents}
      </div>
      <div data-testid="events-count">{events.length} events</div>
      {events.map((item) => (
        <div key={item.event.id} data-testid={`event-${item.event.id}`}>
          {item.event.title} - {item.registrations.length} registration(s)
        </div>
      ))}
      {pagination && (
        <div data-testid="pagination">
          Page {pagination.currentPage} of {pagination.totalPages}
        </div>
      )}
      {onPageChange && (
        <>
          <button onClick={() => onPageChange(1)}>Page 1</button>
          <button onClick={() => onPageChange(2)}>Page 2</button>
        </>
      )}
    </div>
  ),
}));

describe("MyEvents page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders page title", () => {
    render(
      <MemoryRouter>
        <MyEvents />
      </MemoryRouter>
    );

    expect(screen.getByText("My Events")).toBeInTheDocument();
  });

  it("displays event statistics", () => {
    render(
      <MemoryRouter>
        <MyEvents />
      </MemoryRouter>
    );

    expect(screen.getByTestId("stats")).toBeInTheDocument();
    expect(screen.getByText(/total: 2/i)).toBeInTheDocument();
    expect(screen.getByText(/upcoming: 1/i)).toBeInTheDocument();
    expect(screen.getByText(/past: 1/i)).toBeInTheDocument();
  });

  it("groups and displays events", () => {
    render(
      <MemoryRouter>
        <MyEvents />
      </MemoryRouter>
    );

    expect(screen.getByTestId("my-event-list")).toBeInTheDocument();
    expect(screen.getByText("2 events")).toBeInTheDocument();
    expect(screen.getByTestId("event-evt1")).toBeInTheDocument();
    expect(screen.getByTestId("event-evt2")).toBeInTheDocument();
  });

  it("shows registration count per event", () => {
    render(
      <MemoryRouter>
        <MyEvents />
      </MemoryRouter>
    );

    expect(screen.getByText(/past event.*1 registration/i)).toBeInTheDocument();
    expect(
      screen.getByText(/upcoming event.*1 registration/i)
    ).toBeInTheDocument();
  });

  it("displays pagination when available", () => {
    render(
      <MemoryRouter>
        <MyEvents />
      </MemoryRouter>
    );

    expect(screen.getByTestId("pagination")).toBeInTheDocument();
    expect(screen.getByText(/page 1 of 1/i)).toBeInTheDocument();
  });
});

describe("MyEvents page - loading state", () => {
  it("shows loading spinner", async () => {
    vi.resetModules();

    vi.doMock("../../hooks/useEventsApi", () => ({
      useUserEvents: () => ({
        events: [],
        stats: null,
        loading: true,
        error: null,
        refreshEvents: vi.fn(),
        pagination: null,
      }),
    }));

    const { default: LoadingMyEvents } = await import("../../pages/MyEvents");

    render(
      <MemoryRouter>
        <LoadingMyEvents />
      </MemoryRouter>
    );

    expect(
      screen.getByTestId("loading-spinner-fullscreen")
    ).toBeInTheDocument();
  });
});

describe("MyEvents page - error state", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("displays error message and retry button", async () => {
    const mockRetry = vi.fn();

    vi.doMock("../../hooks/useEventsApi", () => ({
      useUserEvents: () => ({
        events: [],
        stats: null,
        loading: false,
        error: "Failed to load events",
        refreshEvents: mockRetry,
        pagination: null,
      }),
    }));

    const { default: ErrorMyEvents } = await import("../../pages/MyEvents");

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ErrorMyEvents />
      </MemoryRouter>
    );

    expect(screen.getByText(/error loading events/i)).toBeInTheDocument();
    expect(screen.getByText(/failed to load events/i)).toBeInTheDocument();

    const retryButton = screen.getByRole("button", { name: /retry/i });
    expect(retryButton).toBeInTheDocument();

    await user.click(retryButton);
    expect(mockRetry).toHaveBeenCalled();
  });
});

describe("MyEvents page - empty state", () => {
  it("handles empty events array", async () => {
    vi.resetModules();

    vi.doMock("../../hooks/useEventsApi", () => ({
      useUserEvents: () => ({
        events: [],
        stats: {
          totalEvents: 0,
          upcomingEvents: 0,
          pastEvents: 0,
        },
        loading: false,
        error: null,
        refreshEvents: vi.fn(),
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalEvents: 0,
          hasNext: false,
          hasPrev: false,
        },
      }),
    }));

    const { default: EmptyMyEvents } = await import("../../pages/MyEvents");

    render(
      <MemoryRouter>
        <EmptyMyEvents />
      </MemoryRouter>
    );

    expect(screen.getByTestId("my-event-list")).toBeInTheDocument();
    expect(screen.getByText("0 events")).toBeInTheDocument();
  });

  it("handles null events", async () => {
    vi.resetModules();

    vi.doMock("../../hooks/useEventsApi", () => ({
      useUserEvents: () => ({
        events: null,
        stats: {
          totalEvents: 0,
          upcomingEvents: 0,
          pastEvents: 0,
        },
        loading: false,
        error: null,
        refreshEvents: vi.fn(),
        pagination: null,
      }),
    }));

    const { default: NullEventsMyEvents } = await import(
      "../../pages/MyEvents"
    );

    render(
      <MemoryRouter>
        <NullEventsMyEvents />
      </MemoryRouter>
    );

    expect(screen.getByTestId("my-event-list")).toBeInTheDocument();
    expect(screen.getByText("0 events")).toBeInTheDocument();
  });
});

describe("MyEvents page - event grouping", () => {
  it("groups multiple registrations for same event", async () => {
    vi.resetModules();

    const multipleRegistrations = [
      {
        event: {
          id: "evt-multi",
          title: "Multi Registration Event",
          date: "2025-12-01",
          endDate: null,
          time: "10:00",
          endTime: "12:00",
        },
        registration: {
          id: "reg1",
          role: "Participant",
          status: "confirmed",
        },
        isPassedEvent: false,
        eventStatus: "upcoming",
      },
      {
        event: {
          id: "evt-multi",
          title: "Multi Registration Event",
          date: "2025-12-01",
          endDate: null,
          time: "10:00",
          endTime: "12:00",
        },
        registration: {
          id: "reg2",
          role: "Organizer",
          status: "confirmed",
        },
        isPassedEvent: false,
        eventStatus: "upcoming",
      },
    ];

    vi.doMock("../../hooks/useEventsApi", () => ({
      useUserEvents: () => ({
        events: multipleRegistrations,
        stats: {
          totalEvents: 1,
          upcomingEvents: 1,
          pastEvents: 0,
        },
        loading: false,
        error: null,
        refreshEvents: vi.fn(),
        pagination: null,
      }),
    }));

    const { default: GroupedMyEvents } = await import("../../pages/MyEvents");

    render(
      <MemoryRouter>
        <GroupedMyEvents />
      </MemoryRouter>
    );

    expect(screen.getByTestId("my-event-list")).toBeInTheDocument();
    expect(screen.getByText("1 events")).toBeInTheDocument(); // 1 event with 2 registrations
    expect(
      screen.getByText(/multi registration event.*2 registration/i)
    ).toBeInTheDocument();
  });

  it("sorts events by end datetime descending", async () => {
    vi.resetModules();

    const eventsWithEndDates = [
      {
        event: {
          id: "evt-early",
          title: "Early Event",
          date: "2025-11-01",
          endDate: "2025-11-01",
          time: "10:00",
          endTime: "12:00",
        },
        registration: {
          id: "reg1",
          role: "Participant",
          status: "confirmed",
        },
        isPassedEvent: true,
        eventStatus: "completed",
      },
      {
        event: {
          id: "evt-late",
          title: "Late Event",
          date: "2025-12-15",
          endDate: "2025-12-15",
          time: "14:00",
          endTime: "16:00",
        },
        registration: {
          id: "reg2",
          role: "Participant",
          status: "confirmed",
        },
        isPassedEvent: false,
        eventStatus: "upcoming",
      },
    ];

    vi.doMock("../../hooks/useEventsApi", () => ({
      useUserEvents: () => ({
        events: eventsWithEndDates,
        stats: {
          totalEvents: 2,
          upcomingEvents: 1,
          pastEvents: 1,
        },
        loading: false,
        error: null,
        refreshEvents: vi.fn(),
        pagination: null,
      }),
    }));

    const { default: SortedMyEvents } = await import("../../pages/MyEvents");

    render(
      <MemoryRouter>
        <SortedMyEvents />
      </MemoryRouter>
    );

    const eventElements = screen.getAllByTestId(/^event-/);
    // Should be sorted descending (late event first)
    expect(eventElements[0]).toHaveAttribute("data-testid", "event-evt-late");
    expect(eventElements[1]).toHaveAttribute("data-testid", "event-evt-early");
  });
});
