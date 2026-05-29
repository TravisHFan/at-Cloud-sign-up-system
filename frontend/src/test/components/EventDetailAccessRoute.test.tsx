import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import EventDetailAccessRoute from "../../components/EventDetail/EventDetailAccessRoute";

const useAuthMock = vi.fn();

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("../../pages/EventDetail", () => ({
  default: () => <div data-testid="event-detail">Event Detail</div>,
}));

vi.mock("../../components/common/LoadingSpinner", () => ({
  default: () => <div data-testid="loading-spinner">Loading</div>,
}));

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/dashboard/event/:id"
          element={<EventDetailAccessRoute />}
        />
        <Route
          path="/p/:slug"
          element={<div data-testid="public-event">Public Event</div>}
        />
        <Route
          path="/events"
          element={<div data-testid="public-events-list">Events</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("EventDetailAccessRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends unauthenticated event detail visitors to the public event page", () => {
    useAuthMock.mockReturnValue({ currentUser: null, isLoading: false });

    renderRoute("/dashboard/event/evt123");

    expect(screen.getByTestId("public-event")).toBeInTheDocument();
    expect(screen.queryByTestId("event-detail")).not.toBeInTheDocument();
  });

  it("renders internal event detail for authenticated users", () => {
    useAuthMock.mockReturnValue({
      currentUser: { id: "user-1", role: "Participant" },
      isLoading: false,
    });

    renderRoute("/dashboard/event/evt123");

    expect(screen.getByTestId("event-detail")).toBeInTheDocument();
  });

  it("waits for auth state before deciding", () => {
    useAuthMock.mockReturnValue({ currentUser: null, isLoading: true });

    renderRoute("/dashboard/event/evt123");

    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });
});
