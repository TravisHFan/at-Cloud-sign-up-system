import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import PublicEventsList from "../../pages/PublicEventsList";
import * as apiModule from "../../services/api";

// Mock the api module
vi.mock("../../services/api", () => ({
  default: {
    getPublicEvents: vi.fn(),
  },
}));

// Mock the Icon component
vi.mock("../../components/common", () => ({
  Icon: ({ name, className }: { name: string; className?: string }) => (
    <span data-testid={`icon-${name}`} className={className} />
  ),
}));

// Mock the event formatter utility
vi.mock("../../utils/eventStatsUtils", () => ({
  formatEventDateTimeRangeInViewerTZ: vi.fn((date, time, endTime) => {
    return `${date} ${time}-${endTime}`;
  }),
}));

// Helper to render with router
const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

// Mock data
const mockEvents = [
  {
    title: "Advanced Communication Workshop",
    type: "Effective Communication Workshop",
    slug: "advanced-comm-workshop",
    start: "2025-02-15T14:00:00Z",
    end: "2025-02-15T17:00:00Z",
    date: "2025-02-15",
    time: "14:00",
    endTime: "17:00",
    timeZone: "America/New_York",
    location: "Training Room A",
    rolesOpen: 3,
    capacityRemaining: 15,
  },
  {
    title: "EMBA Mentor Circle Session",
    type: "Mentor Circle",
    slug: "emba-mentor-circle",
    start: "2025-02-20T18:00:00Z",
    end: "2025-02-20T20:00:00Z",
    date: "2025-02-20",
    time: "18:00",
    endTime: "20:00",
    timeZone: "America/Los_Angeles",
    location: "Online - Zoom",
    rolesOpen: 2,
    capacityRemaining: 8,
  },
  {
    title: "Leadership Conference 2025",
    type: "Conference",
    slug: "leadership-conference-2025",
    start: "2025-03-10T09:00:00Z",
    end: "2025-03-10T17:00:00Z",
    date: "2025-03-10",
    time: "09:00",
    endTime: "17:00",
    timeZone: "America/New_York",
    location: "Main Auditorium",
    rolesOpen: 5,
    capacityRemaining: 50,
  },
];

const mockPagination = {
  page: 1,
  limit: 12,
  total: 3,
  totalPages: 1,
};

describe("PublicEventsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  // ========== Loading States ==========
  describe("Loading States", () => {
    it("should display loading skeleton on initial load", () => {
      const mockGetPublicEvents = vi.fn().mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      expect(screen.getByTestId("events-loading")).toBeInTheDocument();
      // Check for skeleton elements
      const skeletons = screen
        .getAllByRole("generic")
        .filter((el) => el.className.includes("animate-pulse"));
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("should show loading skeleton with 6 placeholder cards", () => {
      const mockGetPublicEvents = vi.fn().mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      const loadingDiv = screen.getByTestId("events-loading");
      const placeholders = within(loadingDiv).getAllByRole("generic", {
        hidden: true,
      });
      const cardPlaceholders = placeholders.filter((el) =>
        el.className.includes("bg-white rounded-lg shadow")
      );
      expect(cardPlaceholders.length).toBe(6);
    });
  });

  // ========== Error Handling ==========
  describe("Error Handling", () => {
    it("should display error message when API call fails", async () => {
      const mockGetPublicEvents = vi
        .fn()
        .mockRejectedValue(new Error("Network error"));
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(screen.getByTestId("events-error")).toBeInTheDocument();
      });

      expect(screen.getByText("Failed to Load Events")).toBeInTheDocument();
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });

    it("should show Try Again button on error", async () => {
      const mockGetPublicEvents = vi
        .fn()
        .mockRejectedValue(new Error("API Error"));
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(screen.getByTestId("events-error")).toBeInTheDocument();
      });

      const tryAgainButton = screen.getByRole("button", { name: /try again/i });
      expect(tryAgainButton).toBeInTheDocument();
    });

    it("should retry loading when Try Again button is clicked", async () => {
      const user = userEvent.setup();
      const mockGetPublicEvents = vi
        .fn()
        .mockRejectedValueOnce(new Error("First error"))
        .mockResolvedValueOnce({
          events: mockEvents,
          pagination: mockPagination,
        });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(screen.getByTestId("events-error")).toBeInTheDocument();
      });

      const tryAgainButton = screen.getByRole("button", { name: /try again/i });
      await user.click(tryAgainButton);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      expect(mockGetPublicEvents).toHaveBeenCalledTimes(2);
    });

    it("should display x-circle icon on error", async () => {
      const mockGetPublicEvents = vi.fn().mockRejectedValue(new Error("Error"));
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(screen.getByTestId("events-error")).toBeInTheDocument();
      });

      expect(screen.getByTestId("icon-x-circle")).toBeInTheDocument();
    });
  });

  // ========== Successful Data Display ==========
  describe("Successful Data Display", () => {
    it("should display events after successful load", async () => {
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: mockEvents,
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      expect(
        screen.getByText("EMBA Mentor Circle Session")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Leadership Conference 2025")
      ).toBeInTheDocument();
    });

    it("should display page header with title and description", async () => {
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: mockEvents,
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(screen.getByText("Public Events")).toBeInTheDocument();
      });

      expect(
        screen.getByText(
          "Discover and register for upcoming events open to the public"
        )
      ).toBeInTheDocument();
    });

    it("should display hosted by section with @Cloud logo", async () => {
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: mockEvents,
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByTestId("public-events-hosted-by")
        ).toBeInTheDocument();
      });

      const hostedBySection = screen.getByTestId("public-events-hosted-by");
      expect(
        within(hostedBySection).getByText(/Hosted by/i)
      ).toBeInTheDocument();
      expect(
        within(hostedBySection).getByText("@Cloud Marketplace Ministry")
      ).toBeInTheDocument();

      const logo = within(hostedBySection).getByAltText("@Cloud Logo");
      expect(logo).toHaveAttribute("src", "/Cloud-removebg.png");
    });

    it("should display search input", async () => {
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: mockEvents,
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search events...")
        ).toBeInTheDocument();
      });
    });

    it("should display type filter dropdown", async () => {
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: mockEvents,
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(screen.getByRole("combobox")).toBeInTheDocument();
      });

      const select = screen.getByRole("combobox");
      expect(within(select).getByText("All Types")).toBeInTheDocument();
    });

    it("should display results count when events are present", async () => {
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: mockEvents,
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText(/Showing 1 to 3 of 3 events/)
        ).toBeInTheDocument();
      });
    });

    it("should display all event type options in filter", async () => {
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: mockEvents,
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(screen.getByRole("combobox")).toBeInTheDocument();
      });

      const select = screen.getByRole("combobox");
      expect(within(select).getByText("Conference")).toBeInTheDocument();
      expect(
        within(select).getByText("Effective Communication Workshop")
      ).toBeInTheDocument();
      expect(within(select).getByText("Mentor Circle")).toBeInTheDocument();
      expect(within(select).getByText("Webinar")).toBeInTheDocument();
    });
  });

  // ========== Empty States ==========
  describe("Empty States", () => {
    it("should display no events message when list is empty", async () => {
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: [],
        pagination: { ...mockPagination, total: 0 },
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(screen.getByText("No events found")).toBeInTheDocument();
      });

      expect(
        screen.getByText("No public events are currently available")
      ).toBeInTheDocument();
    });

    it("should display calendar icon in empty state", async () => {
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: [],
        pagination: { ...mockPagination, total: 0 },
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(screen.getByText("No events found")).toBeInTheDocument();
      });

      expect(screen.getByTestId("icon-calendar")).toBeInTheDocument();
    });

    it("should display adjusted message when search/filter has no results", async () => {
      const mockGetPublicEvents = vi.fn();
      // First call returns events
      mockGetPublicEvents.mockResolvedValueOnce({
        events: mockEvents,
        pagination: mockPagination,
      });
      // All subsequent calls return empty
      mockGetPublicEvents.mockResolvedValue({
        events: [],
        pagination: { ...mockPagination, total: 0 },
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      // Wait for initial load
      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      const user = userEvent.setup();
      const searchInput = screen.getByPlaceholderText("Search events...");
      await user.type(searchInput, "nonexistent");

      // Wait for debounce and API call to show empty state
      await waitFor(
        () => {
          expect(screen.getByText("No events found")).toBeInTheDocument();
        },
        { timeout: 1000 }
      );

      expect(
        screen.getByText("Try adjusting your search criteria")
      ).toBeInTheDocument();
    });
    it("should not display results count when no events", async () => {
      vi.useRealTimers(); // Ensure real timers for this simple test
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: [],
        pagination: { ...mockPagination, total: 0 },
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(screen.getByText("No events found")).toBeInTheDocument();
      });

      expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
    });
  });

  // ========== Search Functionality ==========
  describe("Search Functionality", () => {
    it("should debounce search input", async () => {
      const user = userEvent.setup();
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: mockEvents,
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search events...")
        ).toBeInTheDocument();
      });

      const initialCallCount = mockGetPublicEvents.mock.calls.length;

      const searchInput = screen.getByPlaceholderText("Search events...");
      await user.type(searchInput, "workshop");

      // Wait for debounce to trigger - should have one more call than initial
      await waitFor(
        () => {
          expect(mockGetPublicEvents.mock.calls.length).toBeGreaterThan(
            initialCallCount
          );
        },
        { timeout: 1000 }
      );

      // Verify the search was called with correct params
      const lastCall =
        mockGetPublicEvents.mock.calls[
          mockGetPublicEvents.mock.calls.length - 1
        ][0];
      expect(lastCall.search).toBe("workshop");
    });

    it("should search with correct parameters", async () => {
      const user = userEvent.setup();
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: mockEvents,
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search events...")
        ).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search events...");
      await user.type(searchInput, "conference");

      await waitFor(
        () => {
          expect(mockGetPublicEvents).toHaveBeenCalledWith(
            expect.objectContaining({
              page: 1,
              search: "conference",
            })
          );
        },
        { timeout: 1000 }
      );
    });

    it("should reset to page 1 when searching", async () => {
      const user = userEvent.setup();
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: mockEvents,
        pagination: { ...mockPagination, page: 2, totalPages: 3 },
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search events...")
        ).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search events...");
      await user.type(searchInput, "test");

      await waitFor(
        () => {
          expect(mockGetPublicEvents).toHaveBeenLastCalledWith(
            expect.objectContaining({
              page: 1,
            })
          );
        },
        { timeout: 1000 }
      );
    });

    it("should display search icon in input", async () => {
      vi.useRealTimers(); // Use real timers for this simple display test
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: mockEvents,
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search events...")
        ).toBeInTheDocument();
      });

      const searchSection = screen
        .getByPlaceholderText("Search events...")
        .closest("div");
      const svgIcon = searchSection?.querySelector("svg");
      expect(svgIcon).toBeInTheDocument();
    });
  });

  // ========== Filter Functionality ==========
  describe("Filter Functionality", () => {
    // Note: Not using fake timers as it causes issues with async operations

    it("should filter by event type", async () => {
      const user = userEvent.setup();
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: mockEvents,
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(screen.getByRole("combobox")).toBeInTheDocument();
      });

      const select = screen.getByRole("combobox");
      await user.selectOptions(select, "Conference");

      await waitFor(
        () => {
          expect(mockGetPublicEvents).toHaveBeenCalledWith(
            expect.objectContaining({
              type: "Conference",
            })
          );
        },
        { timeout: 1000 }
      );
    });

    it("should reset to page 1 when filtering", async () => {
      const user = userEvent.setup();
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: mockEvents,
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(screen.getByRole("combobox")).toBeInTheDocument();
      });

      const select = screen.getByRole("combobox");
      await user.selectOptions(select, "Webinar");

      await waitFor(
        () => {
          expect(mockGetPublicEvents).toHaveBeenLastCalledWith(
            expect.objectContaining({
              page: 1,
              type: "Webinar",
            })
          );
        },
        { timeout: 1000 }
      );
    });

    it("should combine search and filter", async () => {
      const user = userEvent.setup();
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: mockEvents,
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Search events...")
        ).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search events...");
      await user.type(searchInput, "workshop");

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 400));

      const select = screen.getByRole("combobox");
      await user.selectOptions(select, "Effective Communication Workshop");

      await waitFor(
        () => {
          expect(mockGetPublicEvents).toHaveBeenCalledWith(
            expect.objectContaining({
              page: 1,
              search: "workshop",
              type: "Effective Communication Workshop",
            })
          );
        },
        { timeout: 1000 }
      );
    });

    it("should clear filter when selecting All Types", async () => {
      const user = userEvent.setup();
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: mockEvents,
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(screen.getByRole("combobox")).toBeInTheDocument();
      });

      const select = screen.getByRole("combobox");
      await user.selectOptions(select, "Conference");

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 400));

      await user.selectOptions(select, "");

      await waitFor(
        () => {
          const lastCall =
            mockGetPublicEvents.mock.calls[
              mockGetPublicEvents.mock.calls.length - 1
            ][0];
          expect(lastCall.type).toBeUndefined();
        },
        { timeout: 1000 }
      );
    });
  });

  // ========== Pagination ==========
  describe("Pagination", () => {
    it("should display pagination when totalPages > 1", async () => {
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: mockEvents,
        pagination: { ...mockPagination, totalPages: 3 },
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      expect(
        screen.getByRole("button", { name: "Previous" })
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
    });

    it("should not display pagination when totalPages = 1", async () => {
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: mockEvents,
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      expect(
        screen.queryByRole("button", { name: "Previous" })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Next" })
      ).not.toBeInTheDocument();
    });

    it("should disable Previous button on first page", async () => {
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: mockEvents,
        pagination: { ...mockPagination, page: 1, totalPages: 3 },
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      const prevButton = screen.getByRole("button", { name: "Previous" });
      expect(prevButton).toBeDisabled();
    });

    it("should disable Next button on last page", async () => {
      const mockGetPublicEvents = vi
        .fn()
        .mockResolvedValueOnce({
          events: mockEvents,
          pagination: { ...mockPagination, page: 1, totalPages: 3 },
        })
        .mockResolvedValueOnce({
          events: mockEvents,
          pagination: { ...mockPagination, page: 3, totalPages: 3 },
        });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      // Navigate to last page first
      const user = userEvent.setup();
      const page3Button = screen.getByRole("button", { name: "3" });
      await user.click(page3Button);

      await waitFor(() => {
        const nextButton = screen.getByRole("button", { name: "Next" });
        expect(nextButton).toBeDisabled();
      });
    });

    it("should navigate to next page when Next clicked", async () => {
      const user = userEvent.setup();
      const mockGetPublicEvents = vi
        .fn()
        .mockResolvedValueOnce({
          events: mockEvents,
          pagination: { ...mockPagination, page: 1, totalPages: 3 },
        })
        .mockResolvedValueOnce({
          events: [mockEvents[0]],
          pagination: { ...mockPagination, page: 2, totalPages: 3 },
        });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      const nextButton = screen.getByRole("button", { name: "Next" });
      await user.click(nextButton);

      await waitFor(() => {
        expect(mockGetPublicEvents).toHaveBeenCalledWith(
          expect.objectContaining({ page: 2 })
        );
      });
    });

    it("should navigate to previous page when Previous clicked", async () => {
      const user = userEvent.setup();
      const mockGetPublicEvents = vi
        .fn()
        .mockResolvedValueOnce({
          events: mockEvents,
          pagination: { ...mockPagination, page: 2, totalPages: 3 },
        })
        .mockResolvedValueOnce({
          events: mockEvents,
          pagination: { ...mockPagination, page: 1, totalPages: 3 },
        });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      const prevButton = screen.getByRole("button", { name: "Previous" });
      await user.click(prevButton);

      await waitFor(() => {
        expect(mockGetPublicEvents).toHaveBeenCalledWith(
          expect.objectContaining({ page: 1 })
        );
      });
    });

    it("should display page numbers", async () => {
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: mockEvents,
        pagination: { ...mockPagination, page: 2, totalPages: 5 },
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "2" })).toBeInTheDocument();
    });

    it("should highlight active page", async () => {
      const user = userEvent.setup();
      const mockGetPublicEvents = vi
        .fn()
        .mockResolvedValueOnce({
          events: mockEvents,
          pagination: { ...mockPagination, page: 1, totalPages: 5 },
        })
        .mockResolvedValueOnce({
          events: mockEvents,
          pagination: { ...mockPagination, page: 2, totalPages: 5 },
        });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      // Navigate to page 2
      const page2Button = screen.getByRole("button", { name: "2" });
      await user.click(page2Button);

      await waitFor(() => {
        const activePage2Button = screen.getByRole("button", { name: "2" });
        expect(activePage2Button).toHaveClass("bg-blue-600");
        expect(activePage2Button).toHaveClass("text-white");
      });
    });

    it("should navigate to specific page when page number clicked", async () => {
      const user = userEvent.setup();
      const mockGetPublicEvents = vi
        .fn()
        .mockResolvedValueOnce({
          events: mockEvents,
          pagination: { ...mockPagination, page: 1, totalPages: 5 },
        })
        .mockResolvedValueOnce({
          events: mockEvents,
          pagination: { ...mockPagination, page: 2, totalPages: 5 },
        });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      const page2Button = screen.getByRole("button", { name: "2" });
      await user.click(page2Button);

      await waitFor(() => {
        expect(mockGetPublicEvents).toHaveBeenCalledWith(
          expect.objectContaining({ page: 2 })
        );
      });
    });

    it("should show ellipsis for page gaps", async () => {
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: mockEvents,
        pagination: { ...mockPagination, page: 5, totalPages: 10 },
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      const ellipses = screen.getAllByText("...");
      expect(ellipses.length).toBeGreaterThan(0);
    });

    it("should always show first and last page buttons", async () => {
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: mockEvents,
        pagination: { ...mockPagination, page: 5, totalPages: 10 },
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "10" })).toBeInTheDocument();
    });
  });

  // ========== Event Card Display ==========
  describe("Event Card Display", () => {
    it("should display event type badge", async () => {
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: [mockEvents[0]],
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      expect(screen.getByText("ECW Series")).toBeInTheDocument();
    });

    it("should display event title", async () => {
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: [mockEvents[1]],
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("EMBA Mentor Circle Session")
        ).toBeInTheDocument();
      });
    });

    it("should display calendar icon for date", async () => {
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: [mockEvents[0]],
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      expect(screen.getByTestId("icon-calendar")).toBeInTheDocument();
    });

    it("should display roles available count", async () => {
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: [mockEvents[0]],
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      expect(screen.getByText("3 roles available")).toBeInTheDocument();
    });

    it("should display capacity remaining", async () => {
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: [mockEvents[0]],
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      expect(screen.getByText("15 spots remaining")).toBeInTheDocument();
    });

    it("should display singular 'role' when rolesOpen = 1", async () => {
      const singleRoleEvent = {
        ...mockEvents[0],
        rolesOpen: 1,
      };

      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: [singleRoleEvent],
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      expect(screen.getByText("1 role available")).toBeInTheDocument();
    });

    it("should display singular 'spot' when capacityRemaining = 1", async () => {
      const singleSpotEvent = {
        ...mockEvents[0],
        capacityRemaining: 1,
      };

      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: [singleSpotEvent],
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      expect(screen.getByText("1 spot remaining")).toBeInTheDocument();
    });

    it("should display View & Register button for upcoming events with spots", async () => {
      const futureEvent = {
        ...mockEvents[0],
        start: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        capacityRemaining: 10,
      };

      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: [futureEvent],
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      const link = screen.getByRole("link", { name: "View & Register" });
      expect(link).toHaveClass("bg-blue-600");
    });

    it("should display View (Full) for upcoming events without spots", async () => {
      const futureFullEvent = {
        ...mockEvents[0],
        start: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        capacityRemaining: 0,
      };

      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: [futureFullEvent],
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      const link = screen.getByRole("link", { name: "View (Full)" });
      expect(link).toHaveClass("bg-gray-300");
    });

    it("should display View Details for past events", async () => {
      const pastEvent = {
        ...mockEvents[0],
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: [pastEvent],
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      const link = screen.getByRole("link", { name: "View Details" });
      expect(link).toBeInTheDocument();
    });

    it("should show Past Event badge for past events", async () => {
      const pastEvent = {
        ...mockEvents[0],
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: [pastEvent],
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      expect(screen.getByText("Past Event")).toBeInTheDocument();
    });

    it("should link to correct event detail page", async () => {
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: [mockEvents[0]],
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "/p/advanced-comm-workshop");
    });

    it("should apply correct color classes for Conference type", async () => {
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: [mockEvents[2]], // Conference
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      const { container } = renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Leadership Conference 2025")
        ).toBeInTheDocument();
      });

      // Query within the event card (not the dropdown)
      const eventCard = container.querySelector(".bg-white.rounded-lg.shadow");
      const badge = within(eventCard as HTMLElement).getByText("Conference");
      expect(badge).toHaveClass("bg-purple-100");
      expect(badge).toHaveClass("text-purple-800");
    });

    it("should apply correct color classes for Mentor Circle type", async () => {
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: [mockEvents[1]], // Mentor Circle
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      const { container } = renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("EMBA Mentor Circle Session")
        ).toBeInTheDocument();
      });

      // Query within the event card (not the dropdown)
      const eventCard = container.querySelector(".bg-white.rounded-lg.shadow");
      const badge = within(eventCard as HTMLElement).getByText("Mentor Circle");
      expect(badge).toHaveClass("bg-blue-100");
      expect(badge).toHaveClass("text-blue-800");
    });

    it("should apply correct color classes for Workshop type", async () => {
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: [mockEvents[0]], // ECW
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      const badge = screen.getByText("ECW Series");
      expect(badge).toHaveClass("bg-orange-100");
      expect(badge).toHaveClass("text-orange-800");
    });

    it("should handle missing event type gracefully", async () => {
      const noTypeEvent = {
        ...mockEvents[0],
        type: undefined,
      };

      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: [noTypeEvent],
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      const badge = screen.getByText("ECW Series"); // Inferred from title
      expect(badge).toBeInTheDocument();
    });

    it("should display Webinar type with correct colors", async () => {
      const webinarEvent = {
        ...mockEvents[0],
        type: "Webinar",
        title: "Sales Excellence Webinar",
      };

      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: [webinarEvent],
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      const { container } = renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Sales Excellence Webinar")
        ).toBeInTheDocument();
      });

      // Query within the event card (not the dropdown)
      const eventCard = container.querySelector(".bg-white.rounded-lg.shadow");
      const badge = within(eventCard as HTMLElement).getByText("Webinar");
      expect(badge).toHaveClass("bg-indigo-100");
      expect(badge).toHaveClass("text-indigo-800");
    });

    it("should show green text for events with available spots", async () => {
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: [mockEvents[0]],
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      const capacityText = screen.getByText("15 spots remaining");
      expect(capacityText).toHaveClass("text-green-600");
    });

    it("should show red text for events with no available spots", async () => {
      const fullEvent = {
        ...mockEvents[0],
        capacityRemaining: 0,
      };

      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: [fullEvent],
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      const capacityText = screen.getByText("0 spots remaining");
      expect(capacityText).toHaveClass("text-red-600");
    });
  });

  // ========== Event Card Error Handling ==========
  describe("Event Card Error Handling", () => {
    it("should handle event card rendering gracefully", async () => {
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: [mockEvents[0]],
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      // Should render event successfully
      expect(screen.getByText("ECW Series")).toBeInTheDocument();
    });
  });

  // ========== Multiple Events Display ==========
  describe("Multiple Events Display", () => {
    it("should render all events in grid", async () => {
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: mockEvents,
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      expect(
        screen.getByText("EMBA Mentor Circle Session")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Leadership Conference 2025")
      ).toBeInTheDocument();
    });

    it("should display events in two-column grid on large screens", async () => {
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: mockEvents,
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      const { container } = renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      const grid = container.querySelector(
        ".grid.md\\:grid-cols-2.lg\\:grid-cols-2"
      );
      expect(grid).toBeInTheDocument();
    });
  });

  // ========== API Parameter Passing ==========
  describe("API Parameter Passing", () => {
    it("should pass limit parameter correctly", async () => {
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: mockEvents,
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(mockGetPublicEvents).toHaveBeenCalledWith(
          expect.objectContaining({
            limit: 12,
          })
        );
      });
    });

    it("should not include search param when search is empty", async () => {
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: mockEvents,
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(mockGetPublicEvents).toHaveBeenCalled();
      });

      const callArgs = mockGetPublicEvents.mock.calls[0][0];
      expect(callArgs.search).toBeUndefined();
    });

    it("should not include type param when filter is empty", async () => {
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: mockEvents,
        pagination: mockPagination,
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(mockGetPublicEvents).toHaveBeenCalled();
      });

      const callArgs = mockGetPublicEvents.mock.calls[0][0];
      expect(callArgs.type).toBeUndefined();
    });
  });

  // ========== Results Count Display ==========
  describe("Results Count Display", () => {
    it("should calculate correct range for first page", async () => {
      const mockGetPublicEvents = vi.fn().mockResolvedValue({
        events: mockEvents.slice(0, 3),
        pagination: { page: 1, limit: 12, total: 15, totalPages: 2 },
      });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        // page 1, limit 12, total 15 -> shows "1 to 12 of 15"
        // (1-1)*12+1 = 1, Math.min(1*12, 15) = 12
        expect(
          screen.getByText(/Showing 1 to 12 of 15 events/)
        ).toBeInTheDocument();
      });
    });

    it("should calculate correct range for last page", async () => {
      const user = userEvent.setup();
      const mockGetPublicEvents = vi
        .fn()
        .mockResolvedValueOnce({
          events: mockEvents,
          pagination: { page: 1, limit: 12, total: 13, totalPages: 2 },
        })
        .mockResolvedValueOnce({
          events: [mockEvents[0]],
          pagination: { page: 2, limit: 12, total: 13, totalPages: 2 },
        });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      // Navigate to page 2
      const page2Button = screen.getByRole("button", { name: "2" });
      await user.click(page2Button);

      await waitFor(() => {
        // page 2, limit 12, total 13 -> shows "13 to 13 of 13"
        // Math.min(2*12, 13) = 13
        expect(
          screen.getByText(/Showing 13 to 13 of 13 events/)
        ).toBeInTheDocument();
      });
    });

    it("should calculate correct range for middle page", async () => {
      const user = userEvent.setup();
      const mockGetPublicEvents = vi
        .fn()
        .mockResolvedValueOnce({
          events: mockEvents,
          pagination: { page: 1, limit: 10, total: 25, totalPages: 3 },
        })
        .mockResolvedValueOnce({
          events: mockEvents,
          pagination: { page: 2, limit: 10, total: 25, totalPages: 3 },
        });
      (apiModule.default.getPublicEvents as any) = mockGetPublicEvents;

      renderWithRouter(<PublicEventsList />);

      await waitFor(() => {
        expect(
          screen.getByText("Advanced Communication Workshop")
        ).toBeInTheDocument();
      });

      // Navigate to page 2
      const page2Button = screen.getByRole("button", { name: "2" });
      await user.click(page2Button);

      await waitFor(() => {
        // page 2, limit 10, total 25 -> shows "11 to 20 of 25"
        // (2-1)*10+1 = 11, Math.min(2*10, 25) = 20
        expect(
          screen.getByText(/Showing 11 to 20 of 25 events/)
        ).toBeInTheDocument();
      });
    });
  });
});
