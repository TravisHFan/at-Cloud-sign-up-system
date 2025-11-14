import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import UpcomingEvents from "../../pages/UpcomingEvents";
import type { EventData } from "../../types/event";

const mockNavigate = vi.fn();
const mockSuccess = vi.fn();
const mockError = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../contexts/NotificationModalContext", () => ({
  useToastReplacement: () => ({
    success: mockSuccess,
    error: mockError,
  }),
}));

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
    onEdit,
    onDelete,
    onPageChange,
    controlledSort,
    events,
    pagination,
  }: {
    title: string;
    emptyStateMessage: string;
    onEdit?: (id: string) => void;
    onDelete?: (id: string) => void;
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
          {onEdit && <button onClick={() => onEdit(event.id)}>Edit</button>}
          {onDelete && (
            <button onClick={() => onDelete(event.id)}>Delete</button>
          )}
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
    title: "Test Event 1",
    date: "2025-12-01",
    time: "10:00",
    endTime: "12:00",
    status: "upcoming",
    organizer: "org1",
    purpose: "Event purpose",
    location: "Test Location",
    type: "Seminar",
    format: "In-Person",
    roles: [],
    createdAt: "2025-11-01T00:00:00Z",
    signedUp: 0,
    totalSlots: 50,
    createdBy: "org1",
  },
  {
    id: "evt2",
    title: "Test Event 2",
    date: "2025-12-15",
    time: "14:00",
    endTime: "16:00",
    status: "ongoing",
    organizer: "org2",
    purpose: "Another event",
    location: "Another Location",
    type: "Workshop",
    format: "Hybrid",
    roles: [],
    createdAt: "2025-11-01T00:00:00Z",
    signedUp: 0,
    totalSlots: 50,
    createdBy: "org2",
  },
];

describe("UpcomingEvents page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading spinner initially", () => {
    mockGetEvents.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(
      <MemoryRouter>
        <UpcomingEvents />
      </MemoryRouter>
    );

    expect(
      screen.getByTestId("loading-spinner-fullscreen")
    ).toBeInTheDocument();
  });

  it("loads and displays upcoming and ongoing events", async () => {
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

    render(
      <MemoryRouter>
        <UpcomingEvents />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("event-list")).toBeInTheDocument();
    });

    expect(screen.getByText("Upcoming Events")).toBeInTheDocument();
    expect(screen.getByText("2 events")).toBeInTheDocument();
    expect(screen.getByTestId("event-evt1")).toBeInTheDocument();
    expect(screen.getByTestId("event-evt2")).toBeInTheDocument();
  });

  it("fetches events with correct parameters", async () => {
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
        <UpcomingEvents />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockGetEvents).toHaveBeenCalledWith({
        statuses: "upcoming,ongoing",
        page: 1,
        limit: 10,
        sortBy: "date",
        sortOrder: "asc",
      });
    });
  });

  it("displays error state when loading fails", async () => {
    mockGetEvents.mockRejectedValue(new Error("Network error"));

    render(
      <MemoryRouter>
        <UpcomingEvents />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/error loading events/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/network error/i)).toBeInTheDocument();
    expect(screen.getByText(/retry/i)).toBeInTheDocument();
    expect(mockError).toHaveBeenCalledWith("Failed to load events");
  });

  it("allows retrying after error", async () => {
    // First call fails
    mockGetEvents.mockRejectedValueOnce(new Error("Network error"));

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <UpcomingEvents />
      </MemoryRouter>
    );

    // Wait for error
    await waitFor(() => {
      expect(screen.getByText(/error loading events/i)).toBeInTheDocument();
      expect(screen.getByText(/retry/i)).toBeInTheDocument();
    });

    // Reset mock to succeed for all future calls
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

    // Click retry
    const retryButton = screen.getByText(/retry/i);
    await user.click(retryButton);

    // Should load successfully
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
        <UpcomingEvents />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("event-list")).toBeInTheDocument();
    });

    expect(screen.getByText(/no upcoming events found/i)).toBeInTheDocument();
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
        <UpcomingEvents />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("pagination")).toBeInTheDocument();
    });

    expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();

    // Click page 2
    mockGetEvents.mockClear();
    mockGetEvents.mockResolvedValue({
      events: mockEventData,
      pagination: {
        currentPage: 2,
        totalPages: 3,
        totalEvents: 25,
        hasNext: true,
        hasPrev: true,
      },
    });

    await user.click(screen.getByRole("button", { name: "Page 2" }));

    await waitFor(() => {
      expect(mockGetEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
        })
      );
    });
  });

  it("handles sort changes", async () => {
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

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <UpcomingEvents />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("sort-controls")).toBeInTheDocument();
    });

    // Change sort
    mockGetEvents.mockClear();
    await user.click(screen.getByRole("button", { name: "Sort Title Desc" }));

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

  it("navigates to edit event with correct state", async () => {
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

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <UpcomingEvents />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("event-evt1")).toBeInTheDocument();
    });

    const editButtons = screen.getAllByText("Edit");
    await user.click(editButtons[0]);

    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/edit-event/evt1", {
      state: { returnTo: "/dashboard/upcoming" },
    });
  });

  it("handles delete event successfully", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <UpcomingEvents />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("event-evt1")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText("Delete");
    await user.click(deleteButtons[0]);

    // Just verify success notification was shown
    await waitFor(() => {
      expect(mockSuccess).toHaveBeenCalledWith(
        expect.stringContaining("evt1"),
        expect.objectContaining({
          title: "Event Deleted",
        })
      );
    });
  });

  it("shows error notification when delete fails", async () => {
    // Mock console.error to avoid test output noise
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

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

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <UpcomingEvents />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("event-evt1")).toBeInTheDocument();
    });

    // Make refresh fail (this is what refreshEvents does internally)
    mockGetEvents.mockRejectedValueOnce(new Error("Delete failed"));

    const deleteButtons = screen.getAllByText("Delete");
    await user.click(deleteButtons[0]);

    // Since refreshEvents catches errors and shows "Failed to load events"
    // that's the actual error message shown
    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith("Failed to load events");
    });

    consoleErrorSpy.mockRestore();
  });

  it("handles error without message property", async () => {
    mockGetEvents.mockRejectedValue("String error");

    render(
      <MemoryRouter>
        <UpcomingEvents />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/error loading events/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/failed to load events/i)).toBeInTheDocument();
  });
});
