import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import PassedEvents from "../../pages/PassedEvents";
import type { EventData } from "../../types/event";

const mockGetEvents = vi.fn();

vi.mock("../../services/api", () => ({
  eventService: {
    getEvents: (...args: unknown[]) => mockGetEvents(...args),
  },
}));

// Mock EventList component
vi.mock("../../components/common/EventList", () => ({
  default: ({
    title,
    emptyStateMessage,
    onPageChange,
    controlledSort,
    events,
    pagination,
    canDelete,
  }: {
    title: string;
    emptyStateMessage: string;
    canDelete?: boolean;
    onPageChange?: (page: number) => void;
    controlledSort?: {
      sortBy: string;
      sortOrder: string;
      onChange: (field: string, order: string) => void;
    };
    events: EventData[];
    pagination?: { currentPage: number; totalPages: number };
  }) => (
    <div data-testid="event-list">
      <h1>{title}</h1>
      <p>{emptyStateMessage}</p>
      <div data-testid="events-count">{events.length} events</div>
      <div data-testid="can-delete">{canDelete ? "yes" : "no"}</div>
      {pagination && (
        <div data-testid="pagination">
          Page {pagination.currentPage} of {pagination.totalPages}
        </div>
      )}
      {controlledSort && (
        <div data-testid="sort-controls">
          <button onClick={() => controlledSort.onChange("date", "asc")}>
            Sort Date Asc
          </button>
          <button onClick={() => controlledSort.onChange("title", "desc")}>
            Sort Title Desc
          </button>
        </div>
      )}
      {events.map((event) => (
        <div key={event.id} data-testid={`event-${event.id}`}>
          {event.title}
        </div>
      ))}
      {onPageChange && (
        <>
          <button onClick={() => onPageChange(1)}>Page 1</button>
          <button onClick={() => onPageChange(2)}>Page 2</button>
        </>
      )}
    </div>
  ),
}));

const mockEventData: EventData[] = [
  {
    id: "evt1",
    title: "Completed Event 1",
    date: "2025-10-01",
    time: "10:00",
    endTime: "12:00",
    status: "completed",
    organizer: "org1",
    purpose: "Past event",
    location: "Location 1",
    type: "Seminar",
    format: "In-Person",
    roles: [],
    createdAt: "2025-09-01T00:00:00Z",
    signedUp: 10,
    totalSlots: 20,
    createdBy: "user1",
  },
  {
    id: "evt2",
    title: "Cancelled Event 2",
    date: "2025-10-15",
    time: "14:00",
    endTime: "16:00",
    status: "cancelled",
    organizer: "org1",
    purpose: "Cancelled event",
    location: "Location 2",
    type: "Workshop",
    format: "Virtual",
    roles: [],
    createdAt: "2025-09-15T00:00:00Z",
    signedUp: 5,
    totalSlots: 15,
    createdBy: "user1",
  },
];

describe("PassedEvents page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEvents.mockResolvedValue({
      events: mockEventData,
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalEvents: 2,
        hasNext: false,
        hasPrev: false,
      },
    });
  });

  it("shows loading spinner initially", () => {
    mockGetEvents.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(
      <MemoryRouter>
        <PassedEvents />
      </MemoryRouter>
    );

    expect(
      screen.getByTestId("loading-spinner-fullscreen")
    ).toBeInTheDocument();
  });

  it("loads and displays passed events", async () => {
    render(
      <MemoryRouter>
        <PassedEvents />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("event-list")).toBeInTheDocument();
    });

    expect(screen.getByText("Past Events")).toBeInTheDocument();
    expect(screen.getByText("2 events")).toBeInTheDocument();
    expect(screen.getByTestId("event-evt1")).toBeInTheDocument();
    expect(screen.getByTestId("event-evt2")).toBeInTheDocument();
  });

  it("fetches events with correct parameters (completed and cancelled)", async () => {
    render(
      <MemoryRouter>
        <PassedEvents />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockGetEvents).toHaveBeenCalledWith({
        statuses: "completed,cancelled",
        page: 1,
        limit: 10,
        sortBy: "date",
        sortOrder: "desc",
      });
    });
  });

  it("displays error state when loading fails", async () => {
    mockGetEvents.mockRejectedValue(new Error("Network error"));

    render(
      <MemoryRouter>
        <PassedEvents />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/error loading events/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/network error/i)).toBeInTheDocument();
    expect(screen.getByText(/retry/i)).toBeInTheDocument();
  });

  it("allows retrying after error", async () => {
    mockGetEvents.mockRejectedValueOnce(new Error("Network error"));

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <PassedEvents />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/error loading events/i)).toBeInTheDocument();
      expect(screen.getByText(/retry/i)).toBeInTheDocument();
    });

    // Reset mock to succeed
    mockGetEvents.mockResolvedValue({
      events: mockEventData,
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalEvents: 2,
        hasNext: false,
        hasPrev: false,
      },
    });

    const retryButton = screen.getByText(/retry/i);
    await user.click(retryButton);

    await waitFor(() => {
      expect(screen.getByTestId("event-list")).toBeInTheDocument();
    });

    expect(screen.getByText("2 events")).toBeInTheDocument();
  });

  it("displays empty state message when no events", async () => {
    mockGetEvents.mockResolvedValue({
      events: [],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalEvents: 0,
        hasNext: false,
        hasPrev: false,
      },
    });

    render(
      <MemoryRouter>
        <PassedEvents />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("event-list")).toBeInTheDocument();
    });

    expect(
      screen.getByText("No completed or cancelled events found.")
    ).toBeInTheDocument();
    expect(screen.getByText("0 events")).toBeInTheDocument();
  });

  it("handles pagination correctly", async () => {
    mockGetEvents.mockResolvedValue({
      events: mockEventData,
      pagination: {
        currentPage: 1,
        totalPages: 3,
        totalEvents: 25,
        hasNext: true,
        hasPrev: false,
      },
    });

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <PassedEvents />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("pagination")).toBeInTheDocument();
    });

    expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();

    // Click page 2
    const page2Button = screen.getByText("Page 2");
    await user.click(page2Button);

    await waitFor(() => {
      expect(mockGetEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
        })
      );
    });
  });

  it("handles sort changes correctly", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <PassedEvents />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("sort-controls")).toBeInTheDocument();
    });

    // Change sort
    const sortButton = screen.getByText("Sort Title Desc");
    await user.click(sortButton);

    await waitFor(() => {
      expect(mockGetEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: "title",
          sortOrder: "desc",
          page: 1, // Should reset to page 1
        })
      );
    });
  });

  it("disables delete functionality (canDelete=false)", async () => {
    render(
      <MemoryRouter>
        <PassedEvents />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("event-list")).toBeInTheDocument();
    });

    expect(screen.getByTestId("can-delete")).toHaveTextContent("no");
  });

  it("handles error without message property", async () => {
    mockGetEvents.mockRejectedValue("String error");

    render(
      <MemoryRouter>
        <PassedEvents />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/error loading events/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/failed to load past events/i)).toBeInTheDocument();
  });
});
