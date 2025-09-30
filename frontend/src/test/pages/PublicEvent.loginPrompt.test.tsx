import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PublicEvent from "../../pages/PublicEvent";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// Mock router (must be before component import usage side-effects)
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ slug: "public-event-login-test" }),
  };
});

vi.mock("../../services/api", () => {
  const baseEvent = {
    id: "evt123",
    title: "Public Event Login Test",
    start: new Date().toISOString(),
    end: new Date(Date.now() + 3600000).toISOString(),
    location: "Online",
    roles: [
      {
        roleId: "r1",
        name: "Volunteer",
        description: "Helps with tasks",
        maxParticipants: 5,
        capacityRemaining: 5,
      },
    ],
    slug: "public-event-login-test",
    date: "2025-01-01",
    endDate: null,
    time: "09:00",
    endTime: "10:00",
    timeZone: "America/New_York",
  };
  return {
    __esModule: true,
    apiClient: {
      getPublicEvent: vi.fn().mockResolvedValue(baseEvent),
    },
    default: {
      getPublicEvent: vi.fn().mockResolvedValue(baseEvent),
    },
  };
});

function renderWithSlug(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/p/${slug}`]}>
      <Routes>
        <Route path="/p/:slug" element={<PublicEvent />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("PublicEvent login prompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows login prompt when viewer unauthenticated", async () => {
    renderWithSlug("public-event-login-test");
    await screen.findByText("Public Event Login Test");
    const prompt = await screen.findByTestId("public-event-login-prompt");
    expect(prompt).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /log in/i });
    expect(link).toHaveAttribute(
      "href",
      "/login?redirect=/dashboard/event/evt123"
    );
  });

  it("hides prompt and auto-redirects when authenticated", async () => {
    // Override BOTH named and default exports so component (default import) uses the authenticated payload
    const mod: any = await import("../../services/api");
    const authedPayload = {
      id: "evt123",
      title: "Auth Event",
      start: new Date().toISOString(),
      end: new Date(Date.now() + 3600000).toISOString(),
      location: "Online",
      roles: [],
      slug: "auth-event",
      date: "2025-01-01",
      endDate: null,
      time: "09:00",
      endTime: "10:00",
      timeZone: "America/New_York",
      isAuthenticated: true,
    };
    mod.apiClient.getPublicEvent.mockResolvedValueOnce(authedPayload);
    mod.default.getPublicEvent.mockResolvedValueOnce(authedPayload);

    renderWithSlug("auth-event");

    // Wait for redirect side-effect (navigate call) which implies isAuthenticated path executed
    await screen.findByText(/Auth Event/);
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/event/evt123", {
      replace: true,
    });
    expect(screen.queryByTestId("public-event-login-prompt")).toBeNull();
  });
});
