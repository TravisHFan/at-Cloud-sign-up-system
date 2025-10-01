import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import PublicEvent from "../../pages/PublicEvent";

// Utility to build base event data
function baseEvent(overrides: Partial<Record<string, any>> = {}) {
  return {
    title: "Format Test Event",
    tagline: "Tag",
    start: new Date().toISOString(),
    end: new Date(Date.now() + 3600000).toISOString(),
    date: "2025-01-01",
    endDate: null,
    time: "09:00",
    endTime: "10:00",
    timeZone: "America/New_York",
    location: "Physical Hall",
    hostedBy: "@Cloud Marketplace Ministry",
    roles: [
      {
        roleId: "r1",
        name: "Attendee",
        description: "General access",
        maxParticipants: 10,
        capacityRemaining: 9,
      },
    ],
    slug: "format-test-event",
    id: "evt-format-test",
    isAuthenticated: false,
    ...overrides,
  };
}

vi.mock("../../services/api", () => {
  const mockApiClient = {
    getPublicEvent: vi.fn(),
    registerForPublicEvent: vi.fn().mockResolvedValue({
      registrationId: "regX",
      duplicate: false,
      message: "Registered successfully",
    }),
  };
  return { __esModule: true, apiClient: mockApiClient, default: mockApiClient };
});

import { apiClient } from "../../services/api";

function renderSlug() {
  return render(
    <MemoryRouter initialEntries={["/p/format-test-event"]}>
      <Routes>
        <Route path="/p/:slug" element={<PublicEvent />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("PublicEvent location format visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Format line and no separate location when format is Online", async () => {
    (apiClient as any).getPublicEvent.mockResolvedValueOnce(
      baseEvent({ format: "Online", location: "Something Else" })
    );
    renderSlug();
    await screen.findByText("Format Test Event");
    // Format line should be displayed
    const formatLine = screen.getByTestId("public-event-format");
    expect(formatLine).toHaveTextContent(/Format:\s*Online/i);
    // Location should not be rendered anymore
    expect(screen.queryByTestId("public-event-location")).toBeNull();
  });

  it("shows only format for Hybrid Participation", async () => {
    (apiClient as any).getPublicEvent.mockResolvedValueOnce(
      baseEvent({ format: "Hybrid Participation" })
    );
    renderSlug();
    await screen.findByText("Format Test Event");
    const formatLine = screen.getByTestId("public-event-format");
    expect(formatLine).toHaveTextContent(/Hybrid Participation/i);
    expect(screen.queryByTestId("public-event-location")).toBeNull();
  });

  it("shows only format for In-person", async () => {
    (apiClient as any).getPublicEvent.mockResolvedValueOnce(
      baseEvent({ format: "In-person" })
    );
    renderSlug();
    await screen.findByText("Format Test Event");
    const formatLine = screen.getByTestId("public-event-format");
    expect(formatLine).toHaveTextContent(/In-person/i);
    expect(screen.queryByTestId("public-event-location")).toBeNull();
  });
});
