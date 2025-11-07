import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import PopulateFromEventModal from "../../../../src/components/rolesTemplate/PopulateFromEventModal";
import type { EventData } from "../../../../src/types/event";
import { searchService } from "../../../../src/services/api";

vi.mock("../../../../src/services/api", () => ({
  searchService: {
    searchEvents: vi.fn(),
  },
}));

const mockEvents: EventData[] = [
  {
    id: "event1",
    title: "Tech Conference 2025",
    type: "Conference",
    date: "2025-11-08",
    time: "16:00",
    endTime: "18:00",
    endDate: undefined,
    timeZone: "America/Los_Angeles",
    location: "Convention Center",
    organizer: "Tech Org",
    format: "in-person",
    roles: [
      {
        id: "role1",
        name: "Volunteer",
        description: "Help attendees",
        maxParticipants: 5,
        currentSignups: [
          { userId: "u1", username: "user1", firstName: "John" },
          { userId: "u2", username: "user2", firstName: "Jane" },
        ],
        openToPublic: true,
      },
      {
        id: "role2",
        name: "Greeter",
        description: "Welcome guests",
        maxParticipants: 3,
        currentSignups: [{ userId: "u3", username: "user3", firstName: "Bob" }],
        openToPublic: true,
      },
    ],
    signedUp: 3,
    totalSlots: 8,
    createdBy: "user1",
    createdAt: new Date().toISOString(),
  },
  {
    id: "event2",
    title: "Leadership Summit",
    type: "Conference",
    date: "2025-12-15",
    time: "09:00",
    endTime: "17:00",
    endDate: undefined,
    timeZone: "America/New_York",
    location: "Hotel Ballroom",
    organizer: "Leadership Org",
    format: "hybrid",
    roles: [
      {
        id: "role3",
        name: "Tech Support",
        description: "Assist with technical issues",
        maxParticipants: 2,
        currentSignups: [],
        openToPublic: true,
      },
    ],
    signedUp: 0,
    totalSlots: 2,
    createdBy: "user2",
    createdAt: new Date().toISOString(),
  },
  {
    id: "event3",
    title: "Conference Without Roles",
    type: "Conference",
    date: "2025-10-20",
    time: "10:00",
    endTime: "12:00",
    endDate: undefined,
    timeZone: "UTC",
    location: "Virtual",
    organizer: "Org",
    format: "virtual",
    roles: [],
    signedUp: 0,
    totalSlots: 0,
    createdBy: "user3",
    createdAt: new Date().toISOString(),
  },
];

describe("PopulateFromEventModal", () => {
  const mockOnClose = vi.fn();
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    render(
      <PopulateFromEventModal
        isOpen={false}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );
    expect(screen.queryByText("Populate from Existing Event")).toBeNull();
  });

  it("renders modal when isOpen is true", async () => {
    vi.mocked(searchService.searchEvents).mockResolvedValue({
      results: mockEvents.filter((e) => e.roles.length > 0),
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalEvents: 2,
        hasNext: false,
        hasPrev: false,
      },
    });

    render(
      <PopulateFromEventModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );

    expect(
      screen.getByText("Populate from Existing Event")
    ).toBeInTheDocument();
  });

  it("loads and displays events with roles on mount", async () => {
    const eventsWithRoles = mockEvents.filter((e) => e.roles.length > 0);
    vi.mocked(searchService.searchEvents).mockResolvedValue({
      results: eventsWithRoles,
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalEvents: 2,
        hasNext: false,
        hasPrev: false,
      },
    });

    render(
      <PopulateFromEventModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Tech Conference 2025")).toBeInTheDocument();
      expect(screen.getByText("Leadership Summit")).toBeInTheDocument();
    });

    // Should show role counts
    expect(screen.getByText("2 roles")).toBeInTheDocument();
    expect(screen.getByText("1 role")).toBeInTheDocument();
  });

  it("filters events by eventType", async () => {
    const eventsWithRoles = mockEvents.filter((e) => e.roles.length > 0);
    vi.mocked(searchService.searchEvents).mockResolvedValue({
      results: eventsWithRoles,
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalEvents: 2,
        hasNext: false,
        hasPrev: false,
      },
    });

    render(
      <PopulateFromEventModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );

    await waitFor(() => {
      expect(searchService.searchEvents).toHaveBeenCalledWith("..", {
        type: "Conference",
      });
    });
  });

  it("excludes events without roles", async () => {
    vi.mocked(searchService.searchEvents).mockResolvedValue({
      results: mockEvents, // Includes event without roles
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalEvents: 3,
        hasNext: false,
        hasPrev: false,
      },
    });

    render(
      <PopulateFromEventModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Tech Conference 2025")).toBeInTheDocument();
      expect(screen.getByText("Leadership Summit")).toBeInTheDocument();
    });

    // Should not show the event without roles
    expect(screen.queryByText("Conference Without Roles")).toBeNull();
  });

  it("handles search functionality", async () => {
    const eventsWithRoles = mockEvents.filter((e) => e.roles.length > 0);
    vi.mocked(searchService.searchEvents).mockResolvedValue({
      results: eventsWithRoles,
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalEvents: 2,
        hasNext: false,
        hasPrev: false,
      },
    });

    render(
      <PopulateFromEventModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Tech Conference 2025")).toBeInTheDocument();
    });

    // Search for "Leadership"
    const searchInput = screen.getByPlaceholderText(
      "Search events by title..."
    );
    fireEvent.change(searchInput, { target: { value: "Leadership" } });

    await waitFor(() => {
      expect(screen.getByText("Leadership Summit")).toBeInTheDocument();
      expect(screen.queryByText("Tech Conference 2025")).toBeNull();
    });
  });

  it("displays empty state when no events with roles found", async () => {
    vi.mocked(searchService.searchEvents).mockResolvedValue({
      results: [],
      pagination: {
        currentPage: 1,
        totalPages: 0,
        totalEvents: 0,
        hasNext: false,
        hasPrev: false,
      },
    });

    render(
      <PopulateFromEventModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText("No Conference events with roles found")
      ).toBeInTheDocument();
    });
  });

  it("displays error state when loading fails", async () => {
    vi.mocked(searchService.searchEvents).mockRejectedValue(
      new Error("Network error")
    );

    render(
      <PopulateFromEventModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("calls onSelect with event data when event is clicked", async () => {
    const eventsWithRoles = mockEvents.filter((e) => e.roles.length > 0);
    vi.mocked(searchService.searchEvents).mockResolvedValue({
      results: eventsWithRoles,
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalEvents: 2,
        hasNext: false,
        hasPrev: false,
      },
    });

    render(
      <PopulateFromEventModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Tech Conference 2025")).toBeInTheDocument();
    });

    const eventButton = screen
      .getByText("Tech Conference 2025")
      .closest("button");
    fireEvent.click(eventButton!);

    expect(mockOnSelect).toHaveBeenCalledWith(eventsWithRoles[0]);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("calls onClose when Cancel button is clicked", async () => {
    vi.mocked(searchService.searchEvents).mockResolvedValue({
      results: [],
      pagination: {
        currentPage: 1,
        totalPages: 0,
        totalEvents: 0,
        hasNext: false,
        hasPrev: false,
      },
    });

    render(
      <PopulateFromEventModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Cancel"));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("calls onClose when close button (X) is clicked", async () => {
    vi.mocked(searchService.searchEvents).mockResolvedValue({
      results: [],
      pagination: {
        currentPage: 1,
        totalPages: 0,
        totalEvents: 0,
        hasNext: false,
        hasPrev: false,
      },
    });

    render(
      <PopulateFromEventModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText("Populate from Existing Event")
      ).toBeInTheDocument();
    });

    // Find and click the close button (X icon)
    const closeButtons = screen.getAllByRole("button");
    const closeButton = closeButtons.find((btn) => btn.querySelector("svg"));
    if (closeButton) {
      fireEvent.click(closeButton);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it("handles pagination correctly", async () => {
    // Create more than 10 events to trigger pagination
    const manyEvents: EventData[] = Array.from({ length: 15 }, (_, i) => ({
      ...mockEvents[0],
      id: `event${i}`,
      title: `Event ${i + 1}`,
      roles: [
        {
          id: `role${i}`,
          name: "Role",
          description: "Desc",
          maxParticipants: 5,
          currentSignups: [],
          openToPublic: true,
        },
      ],
    }));

    vi.mocked(searchService.searchEvents).mockResolvedValue({
      results: manyEvents,
      pagination: {
        currentPage: 1,
        totalPages: 2,
        totalEvents: 15,
        hasNext: true,
        hasPrev: false,
      },
    });

    render(
      <PopulateFromEventModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Event 1")).toBeInTheDocument();
    });

    // Should show first 10 events
    expect(screen.getByText("Event 1")).toBeInTheDocument();
    expect(screen.getByText("Event 10")).toBeInTheDocument();
    expect(screen.queryByText("Event 11")).toBeNull();

    // Should show pagination info
    expect(screen.getByText(/Page 1 of 2/i)).toBeInTheDocument();

    // Click next page
    const nextButton = screen.getByText("Next");
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText("Event 11")).toBeInTheDocument();
    });

    // Should show remaining events
    expect(screen.getByText("Event 15")).toBeInTheDocument();
    expect(screen.queryByText("Event 1")).toBeNull();
  });

  it("displays loading state while fetching events", async () => {
    vi.mocked(searchService.searchEvents).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                results: [],
                pagination: {
                  currentPage: 1,
                  totalPages: 0,
                  totalEvents: 0,
                  hasNext: false,
                  hasPrev: false,
                },
              }),
            100
          )
        )
    );

    render(
      <PopulateFromEventModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );

    expect(screen.getByText(/Loading/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).toBeNull();
    });
  });

  it("reloads events when modal is reopened", async () => {
    const eventsWithRoles = mockEvents.filter((e) => e.roles.length > 0);
    vi.mocked(searchService.searchEvents).mockResolvedValue({
      results: eventsWithRoles,
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalEvents: 2,
        hasNext: false,
        hasPrev: false,
      },
    });

    const { rerender } = render(
      <PopulateFromEventModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );

    await waitFor(() => {
      expect(searchService.searchEvents).toHaveBeenCalledTimes(1);
    });

    // Close modal
    rerender(
      <PopulateFromEventModal
        isOpen={false}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );

    // Reopen modal
    rerender(
      <PopulateFromEventModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );

    await waitFor(() => {
      expect(searchService.searchEvents).toHaveBeenCalledTimes(2);
    });
  });

  it("displays event information with proper formatting", async () => {
    const eventsWithRoles = [mockEvents[0]];
    vi.mocked(searchService.searchEvents).mockResolvedValue({
      results: eventsWithRoles,
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalEvents: 1,
        hasNext: false,
        hasPrev: false,
      },
    });

    render(
      <PopulateFromEventModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Tech Conference 2025")).toBeInTheDocument();
    });

    // Check that calendar icon is present
    const calendarIcons = document.querySelectorAll("svg");
    expect(calendarIcons.length).toBeGreaterThan(0);

    // Check role count display
    expect(screen.getByText("2 roles")).toBeInTheDocument();
  });
});
