import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  within,
  fireEvent,
} from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { NotificationProvider } from "../../contexts/NotificationModalContext";
import ProgramDetail from "../../pages/ProgramDetail";

const genEvents = (count: number) =>
  Array.from({ length: count }).map((_, i) => {
    const idx = i + 1;
    const day = String((idx % 28) + 1).padStart(2, "0");
    return {
      id: `e${idx}`,
      title: `Event ${idx}`,
      type: "Mentor Circle",
      date: `2025-01-${day}`,
      time: "10:00",
      endTime: "11:00",
      location: "",
      organizer: "",
      roles: [],
      signedUp: 0,
      totalSlots: 0,
      format: "Online" as const,
      createdBy: "u1",
      createdAt: new Date().toISOString(),
    };
  });

vi.mock("../../services/api", async () => {
  const { createMockApiServices } = await import("../helpers/mockServices");
  return createMockApiServices({
    programService: {
      getById: vi.fn(async () => ({
        id: "p1",
        title: "EMBA 2025",
        programType: "EMBA Mentor Circles" as const,
        introduction: "Mentor circles for EMBA cohort.",
      })),
      listEvents: vi.fn(async () => genEvents(21)),
      listProgramEvents: vi.fn(async () => genEvents(21)),
      listProgramEventsPaged: vi.fn(async () => ({
        items: genEvents(20),
        page: 1,
        limit: 20,
        total: 21,
        totalPages: 2,
      })),
    },
  });
});

// Import after mocking
const { programService } = await import("../../services/api");

// Mock Auth context to avoid requiring an AuthProvider in tests
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: { id: "u-admin", role: "Administrator" },
    isAuthenticated: true,
    isLoading: false,
    // Grant all roles to keep UI paths available during tests
    hasRole: () => true,
    canCreateEvents: true,
    canManageUsers: true,
    login: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: "p1" }),
  };
});

describe("ProgramDetail Events Pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to page 1 and limit 20", async () => {
    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={["/dashboard/programs/p1"]}>
          <Routes>
            <Route path="/dashboard/programs/:id" element={<ProgramDetail />} />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );

    // Wait for heading to ensure page loaded
    await waitFor(() =>
      expect(screen.getByText("EMBA 2025")).toBeInTheDocument()
    );

    // Scope queries to the Events section container
    const eventsHeading = screen.getByRole("heading", { name: /events/i });
    const section = eventsHeading.closest("div")!.parentElement!; // container with the list

    const pageInfo = within(section).getByText(/Page \d+ of \d+/i);
    expect(pageInfo.textContent).toMatch(/Page 1 of 2/);

    const list = within(section).getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items.length).toBe(20);
  });

  it("navigates Prev/Next with disabled edge states", async () => {
    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={["/dashboard/programs/p1"]}>
          <Routes>
            <Route path="/dashboard/programs/:id" element={<ProgramDetail />} />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );

    await waitFor(() =>
      expect(screen.getByText("EMBA 2025")).toBeInTheDocument()
    );
    const eventsHeading = screen.getByRole("heading", { name: /events/i });
    const section = eventsHeading.closest("div")!.parentElement!;

    const prev = within(section).getByRole("button", {
      name: /previous page/i,
    });
    const next = within(section).getByRole("button", { name: /next page/i });
    expect(prev).toBeDisabled();

    // Go to page 2
    fireEvent.click(next);
    expect(within(section).getByText(/Page 2 of 2/)).toBeInTheDocument();
    expect(next).toBeDisabled();

    const list = within(section).getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items.length).toBe(1);

    // Go back to page 1
    fireEvent.click(prev);
    expect(within(section).getByText(/Page 1 of 2/)).toBeInTheDocument();
  });

  it("reads initial page and sort from URL (deep link)", async () => {
    // Ensure enough events for 3 pages (limit=20 by default)
    (
      programService.listProgramEvents as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(genEvents(45));

    render(
      <NotificationProvider>
        <MemoryRouter
          initialEntries={["/dashboard/programs/p1?page=2&sort=desc"]}
        >
          <Routes>
            <Route path="/dashboard/programs/:id" element={<ProgramDetail />} />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );

    await waitFor(() =>
      expect(screen.getByText("EMBA 2025")).toBeInTheDocument()
    );
    const eventsHeading = screen.getByRole("heading", { name: /events/i });
    const section = eventsHeading.closest("div")!.parentElement!;

    // Page should initialize from URL to 2
    expect(within(section).getByText(/Page 2 of 3/)).toBeInTheDocument();
    // Sort select should reflect "desc" from URL
    const sortSelect = within(section).getByLabelText(
      /sort events/i
    ) as HTMLSelectElement;
    expect(sortSelect.value).toBe("desc");
  });

  it("shows list-only spinner in server mode during slow page fetch", async () => {
    // We'll enable server pagination for this render via component prop

    // First call (initial load): quick resolve with page 1
    (
      programService.listProgramEventsPaged as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({
      items: genEvents(20),
      page: 1,
      limit: 20,
      total: 21,
      totalPages: 2,
    });

    // Second call (after clicking Next): manual resolve control for deterministic spinner check
    const deferredSecondPage: { resolve: (v: any) => void } = {
      resolve: () => {},
    };
    const secondPagePayload = {
      items: genEvents(1).map((e, i) => ({ ...e, id: `e-last-${i}` })),
      page: 2,
      limit: 20,
      total: 21,
      totalPages: 2,
    };
    (
      programService.listProgramEventsPaged as ReturnType<typeof vi.fn>
    ).mockImplementationOnce(
      () =>
        new Promise((resolve: (v: any) => void) => {
          deferredSecondPage.resolve = resolve;
        })
    );

    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={["/dashboard/programs/p1"]}>
          <Routes>
            <Route
              path="/dashboard/programs/:id"
              element={<ProgramDetail forceServerPagination />}
            />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );

    // Wait for initial load and verify controls show page 1
    await waitFor(() =>
      expect(screen.getByText("EMBA 2025")).toBeInTheDocument()
    );
    const eventsHeading = screen.getByRole("heading", { name: /events/i });
    const section = eventsHeading.closest("div")!.parentElement!;
    expect(within(section).getByText(/Page 1 of 2/)).toBeInTheDocument();

    // Trigger Next page (will set spinner immediately and keep page text at 1 until data arrives)
    fireEvent.click(
      within(section).getByRole("button", { name: /next page/i })
    );
    // While pending, page text may still read 1 of 2; spinner should be visible
    const spinner = await within(section).findByRole("status");
    expect(spinner).toBeInTheDocument();
    expect(within(spinner).getByText(/loading events/i)).toBeInTheDocument();

    // Resolve the pending request and wait for UI to update
    deferredSecondPage.resolve(secondPagePayload);
    await waitFor(() =>
      expect(within(section).getByText(/Page 2 of 2/)).toBeInTheDocument()
    );

    // Spinner should disappear after load
    await waitFor(() =>
      expect(within(section).queryByRole("status")).toBeNull()
    );
    // no cleanup needed; prop is local to this render
  });
});
