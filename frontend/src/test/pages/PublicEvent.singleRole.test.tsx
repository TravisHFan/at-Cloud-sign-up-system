import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import PublicEvent from "../../pages/PublicEvent";
import { vi } from "vitest";

// Mock API client
vi.mock("../../services/api", () => ({
  default: {
    getPublicEvent: vi.fn(),
  },
}));

// Mock useParams
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ slug: "test-event" }),
    useNavigate: () => vi.fn(),
  };
});

describe("PublicEvent - Single Role UI", () => {
  const mockSingleRoleEventData = {
    id: "event123",
    title: "Test Workshop",
    description: "A test workshop",
    date: "2024-12-15",
    time: "10:00 AM",
    endTime: "12:00 PM",
    timeZone: "America/New_York",
    endDate: "2024-12-15",
    location: "Test Location",
    format: "In-person",
    roles: [
      {
        roleId: "role1",
        name: "Participant",
        description: "Workshop participant",
        maxParticipants: 50,
        capacityRemaining: 25,
      },
    ],
    isAuthenticated: false,
  };

  const mockMultiRoleEventData = {
    id: "event123",
    title: "Test Conference",
    description: "A test conference",
    date: "2024-12-20",
    time: "9:00 AM",
    endTime: "5:00 PM",
    timeZone: "America/New_York",
    endDate: "2024-12-20",
    location: "Conference Center",
    format: "In-person",
    roles: [
      {
        roleId: "role1",
        name: "Attendee",
        description: "Conference attendee",
        maxParticipants: 100,
        capacityRemaining: 50,
      },
      {
        roleId: "role2",
        name: "Speaker",
        description: "Conference speaker",
        maxParticipants: 10,
        capacityRemaining: 3,
      },
    ],
    isAuthenticated: false,
  };

  it("should show 'Reserve a Spot' heading for single role events", async () => {
    const apiClient = await import("../../services/api");
    (apiClient.default.getPublicEvent as any).mockResolvedValue(
      mockSingleRoleEventData
    );

    render(
      <BrowserRouter>
        <PublicEvent />
      </BrowserRouter>
    );

    // Wait for component to load and check heading
    expect(await screen.findByText("Reserve a Spot")).toBeInTheDocument();
    expect(screen.queryByText("Available Roles")).not.toBeInTheDocument();
  });

  it("should show 'Available Roles' heading for multiple role events", async () => {
    const apiClient = await import("../../services/api");
    (apiClient.default.getPublicEvent as any).mockResolvedValue(
      mockMultiRoleEventData
    );

    render(
      <BrowserRouter>
        <PublicEvent />
      </BrowserRouter>
    );

    // Wait for component to load and check heading
    expect(await screen.findByText("Available Roles")).toBeInTheDocument();
    expect(screen.queryByText("Reserve a Spot")).not.toBeInTheDocument();
  });

  it("should show 'Get a Ticket' button for single role events", async () => {
    const apiClient = await import("../../services/api");
    (apiClient.default.getPublicEvent as any).mockResolvedValue(
      mockSingleRoleEventData
    );

    render(
      <BrowserRouter>
        <PublicEvent />
      </BrowserRouter>
    );

    // Wait for component to load and check button text
    expect(await screen.findByText("Get a Ticket")).toBeInTheDocument();
    expect(screen.queryByText("Select This Role")).not.toBeInTheDocument();
  });

  it("should show 'Select This Role' button for multiple role events", async () => {
    const apiClient = await import("../../services/api");
    (apiClient.default.getPublicEvent as any).mockResolvedValue(
      mockMultiRoleEventData
    );

    render(
      <BrowserRouter>
        <PublicEvent />
      </BrowserRouter>
    );

    // Wait for component to load and check button text
    expect(await screen.findAllByText("Select This Role")).toHaveLength(2);
    expect(screen.queryByText("Get a Ticket")).not.toBeInTheDocument();
  });

  it("should not show role selection message for single role events", async () => {
    const apiClient = await import("../../services/api");
    (apiClient.default.getPublicEvent as any).mockResolvedValue(
      mockSingleRoleEventData
    );

    render(
      <BrowserRouter>
        <PublicEvent />
      </BrowserRouter>
    );

    // Wait for component to load
    await screen.findByText("Register");

    // Should not show role selection message
    expect(
      screen.queryByText("Select a role above to begin registration.")
    ).not.toBeInTheDocument();
  });

  it("should show role selection message for multiple role events", async () => {
    const apiClient = await import("../../services/api");
    (apiClient.default.getPublicEvent as any).mockResolvedValue(
      mockMultiRoleEventData
    );

    render(
      <BrowserRouter>
        <PublicEvent />
      </BrowserRouter>
    );

    // Wait for component to load and check message (text includes line break, so use partial match)
    expect(
      await screen.findByText("Select a role above to begin registration.", {
        exact: false,
      })
    ).toBeInTheDocument();
  });
});
