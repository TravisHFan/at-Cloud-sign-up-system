import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("../../services/api", () => ({
  apiClient: {
    getEvent: vi.fn(),
  },
}));

import { apiClient } from "../../services/api";
import GuestConfirmation from "../../pages/GuestConfirmation";

describe("GuestConfirmation organizer contact rendering", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders organizer contact details when provided by the event", async () => {
    (apiClient.getEvent as any).mockResolvedValue({
      id: "e1",
      title: "Community Event",
      organizerDetails: [
        {
          name: "Alice Smith",
          role: "Organizer",
          email: "alice@example.com",
          phone: "+1 555-0100",
        },
        {
          name: "Bob Lee",
          role: "Co-organizer",
          email: "bob@example.com",
        },
      ],
    });

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/guest-confirmation",
            state: {
              eventId: "e1",
              guest: { eventTitle: "Community Event", roleName: "Participant" },
            },
          } as any,
        ]}
      >
        <Routes>
          <Route path="/guest-confirmation" element={<GuestConfirmation />} />
        </Routes>
      </MemoryRouter>
    );

    // Section header
    expect(await screen.findByText(/Organizer Contact/i)).toBeInTheDocument();

    // Contacts from organizerDetails
    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.getByText("Bob Lee")).toBeInTheDocument();
    });

    // Email links
    const aliceEmail = screen.getByRole("link", { name: "alice@example.com" });
    expect(aliceEmail).toHaveAttribute("href", "mailto:alice@example.com");
    // Phone displayed inline
    expect(screen.getByText(/\+1 555-0100/)).toBeInTheDocument();
  });

  it("shows fallback text when organizer details are missing", async () => {
    (apiClient.getEvent as any).mockResolvedValue({
      id: "e2",
      title: "Another Event",
      organizerDetails: [],
    });

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/guest-confirmation",
            state: {
              eventId: "e2",
              guest: { eventTitle: "Another Event", roleName: "Participant" },
            },
          } as any,
        ]}
      >
        <Routes>
          <Route path="/guest-confirmation" element={<GuestConfirmation />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Organizer Contact/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Contact information will be provided upon registration\./i
      )
    ).toBeInTheDocument();
  });

  it("merges primary Organizer from createdBy with co-organizers and deduplicates by email", async () => {
    (apiClient.getEvent as any).mockResolvedValue({
      id: "e3",
      title: "Merged Contacts Event",
      createdBy: {
        firstName: "John",
        lastName: "Doe",
        email: "john@org.com",
        phone: "+1 555-2222",
      },
      organizerDetails: [
        {
          name: "Alice Smith",
          role: "Co-organizer",
          email: "alice@example.com",
        },
        // Duplicate email should be ignored
        {
          name: "Johnathan Doe",
          role: "Organizer",
          email: "john@org.com",
        },
      ],
    });

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/guest-confirmation",
            state: {
              eventId: "e3",
              guest: {
                eventTitle: "Merged Contacts Event",
                roleName: "Participant",
              },
            },
          } as any,
        ]}
      >
        <Routes>
          <Route path="/guest-confirmation" element={<GuestConfirmation />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for organizer list to render
    expect(await screen.findByText(/Organizer Contact/i)).toBeInTheDocument();

    // Primary organizer from createdBy appears with role label
    await waitFor(() => {
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
    });
    const johnEmailLinks = screen.getAllByRole("link", {
      name: "john@org.com",
    });
    expect(johnEmailLinks).toHaveLength(1);
    expect(johnEmailLinks[0]).toHaveAttribute("href", "mailto:john@org.com");

    // Co-organizer also present
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    const aliceEmail = screen.getByRole("link", { name: "alice@example.com" });
    expect(aliceEmail).toHaveAttribute("href", "mailto:alice@example.com");
  });
});
