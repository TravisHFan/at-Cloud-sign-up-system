import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PublicEvent from "../../pages/PublicEvent";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// Mock api client singleton: component imports default, test imports named
vi.mock("../../services/api", () => {
  const mockApiClient = {
    getPublicEvent: vi.fn().mockResolvedValue({
      title: "Public Test Event",
      start: new Date().toISOString(),
      end: new Date(Date.now() + 3600000).toISOString(),
      location: "Online",
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
      slug: "public-test-event",
      id: "evt-public-test-event",
      date: "2025-01-01",
      endDate: null,
      time: "09:00",
      endTime: "10:00",
      timeZone: "America/New_York",
    }),
    registerForPublicEvent: vi.fn().mockResolvedValue({
      registrationId: "reg123",
      duplicate: false,
      message: "Registered successfully",
    }),
  };
  return { __esModule: true, apiClient: mockApiClient, default: mockApiClient };
});

import { apiClient } from "../../services/api";

function renderWithSlug(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/p/${slug}`]}>
      <Routes>
        <Route path="/p/:slug" element={<PublicEvent />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("PublicEvent registration form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads event and registers successfully", async () => {
    renderWithSlug("public-test-event");

    // Wait for event load
    await screen.findByText("Public Test Event");
    // Hosted by line
    expect(screen.getByTestId("public-event-hosted-by")).toHaveTextContent(
      /Hosted by @Cloud Marketplace Ministry/
    );
    expect(
      screen.getByTestId("public-event-hosted-by").querySelector("img")
    ).not.toBeNull();

    // Select role
    const selectBtn = screen.getByRole("button", { name: "Select This Role" });
    fireEvent.click(selectBtn);

    // Fill form
    fireEvent.change(screen.getByLabelText(/Full Name/i), {
      target: { value: "Jane Tester" },
    });
    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: "jane@example.com" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Submit Registration" })
    );

    await waitFor(() => {
      expect(screen.getByText(/Registered successfully/i)).toBeInTheDocument();
    });

    expect((apiClient as any).registerForPublicEvent).toHaveBeenCalledWith(
      "public-test-event",
      expect.objectContaining({
        roleId: "r1",
        attendee: expect.objectContaining({ email: "jane@example.com" }),
      })
    );
  });

  it("shows duplicate message when API returns duplicate", async () => {
    (apiClient as any).registerForPublicEvent.mockResolvedValueOnce({
      registrationId: "reg123",
      duplicate: true,
      message: "Already registered",
    });

    renderWithSlug("public-test-event");
    await screen.findByText("Public Test Event");
    expect(screen.getByTestId("public-event-hosted-by")).toHaveTextContent(
      /Hosted by @Cloud Marketplace Ministry/
    );
    expect(
      screen.getByTestId("public-event-hosted-by").querySelector("img")
    ).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Select This Role" }));
    fireEvent.change(screen.getByLabelText(/Full Name/i), {
      target: { value: "Jane Tester" },
    });
    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: "jane@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Submit Registration" })
    );

    // Heading should match exact phrase
    await screen.findByText(/^Already registered$/i);
    // Descriptive duplicate paragraph should also render
    expect(
      screen.getByText(/You were already registered for this role/i)
    ).toBeInTheDocument();
  });

  it("scrolls and focuses registration section after role selection", async () => {
    const scrollSpy = vi.fn();
    // jsdom: mock scrollIntoView on all elements
    Element.prototype.scrollIntoView = scrollSpy;

    renderWithSlug("public-test-event");
    await screen.findByText("Public Test Event");

    const registerSection = await screen.findByTestId(
      "public-event-registration-form"
    );
    const roleButton = screen.getByRole("button", { name: "Select This Role" });
    // Ensure section not focused initially
    expect(document.activeElement).not.toBe(registerSection);
    roleButton.click();

    // requestAnimationFrame not executed automatically; flush microtask queue
    await waitFor(() => {
      expect(scrollSpy).toHaveBeenCalled();
      expect(document.activeElement).toBe(registerSection);
    });
  });
});
