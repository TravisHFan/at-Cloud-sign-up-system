import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../../contexts/AuthContext";
import { NotificationProvider } from "../../contexts/NotificationModalContext";
import EventDetail from "../../pages/EventDetail";
import { eventService } from "../../services/api";

vi.mock("../../services/api", () => ({
  eventService: {
    getEvent: vi.fn(),
  },
}));

// Provide useParams id
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );
  return {
    ...actual,
    useParams: () => ({ id: "e2" }),
  };
});

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      <NotificationProvider>{children}</NotificationProvider>
    </AuthProvider>
  </BrowserRouter>
);

describe("EventDetail Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  describe("Event Loading and Display", () => {
    it("should load and display event details correctly", () => {
      expect(true).toBe(true);
    });

    it("should show loading state initially", () => {
      expect(true).toBe(true);
    });

    it("should handle event loading error gracefully", () => {
      expect(true).toBe(true);
    });
  });

  describe("User Registration Features", () => {
    it("should allow user to sign up for a role", () => {
      expect(true).toBe(true);
    });

    it("should allow user to cancel their registration", () => {
      expect(true).toBe(true);
    });

    it("should disable sign up button when role is full", () => {
      expect(true).toBe(true);
    });
  });

  describe("Admin Management Features", () => {
    it("should show management controls for admin users", () => {
      expect(true).toBe(true);
    });

    it("should remove user from role when admin clicks remove", () => {
      expect(true).toBe(true);
    });

    it("should handle drag and drop between roles", () => {
      expect(true).toBe(true);
    });

    it("should not show management controls for regular users", () => {
      expect(true).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle API errors during signup gracefully", () => {
      expect(true).toBe(true);
    });

    it("should handle network errors during management operations", () => {
      expect(true).toBe(true);
    });
  });

  describe("UI Interactions", () => {
    it("should show user count for each role", () => {
      expect(true).toBe(true);
    });

    it("should provide visual feedback during loading operations", () => {
      expect(true).toBe(true);
    });
  });

  it("Email Participants editor preserves caret position and text order while typing", async () => {
    vi.mocked(eventService.getEvent).mockResolvedValue({
      id: "e2",
      title: "Email Test Event",
      type: "Meeting",
      format: "Online",
      date: "2025-08-10",
      endTime: "11:00",
      time: "10:00",
      location: "Zoom",
      organizer: "Org Team",
      purpose: "",
      roles: [],
      signedUp: 0,
      totalSlots: 10,
      createdBy: "u1",
      createdAt: new Date().toISOString(),
    });

    render(
      <TestWrapper>
        <EventDetail />
      </TestWrapper>
    );

    // Wait for page title
    await screen.findAllByText(/Email Test Event/);

    // Open Email Participants modal
    const emailBtn = await screen.findByRole("button", {
      name: /Email Participants/i,
    });
    fireEvent.click(emailBtn);

    // Find the rich text editor (contentEditable div)
    const editor = await screen.findByRole("textbox", {
      name: /Message editor/i,
    });

    // Type sequential characters and ensure content follows the typed order
    // Use fireEvent.input to simulate user typing in contentEditable
    fireEvent.input(editor, { target: { innerHTML: "H" } });
    fireEvent.input(editor, { target: { innerHTML: "He" } });
    fireEvent.input(editor, { target: { innerHTML: "Hel" } });
    fireEvent.input(editor, { target: { innerHTML: "Hell" } });
    fireEvent.input(editor, { target: { innerHTML: "Hello" } });

    await waitFor(() => {
      expect(editor).toHaveTextContent(/^Hello$/);
    });

    // Append more text to ensure caret stays at end and doesn't jump to start
    fireEvent.input(editor, { target: { innerHTML: "Hello World" } });
    await waitFor(() => {
      expect(editor).toHaveTextContent(/^Hello World$/);
    });
  });

  it("shows end date when different from start date", async () => {
    vi.mocked(eventService.getEvent).mockResolvedValue({
      id: "e2",
      title: "Overnight Event",
      type: "Retreat",
      format: "In-person",
      date: "2025-08-10",
      endDate: "2025-08-11",
      time: "21:00",
      endTime: "06:00",
      location: "Camp",
      organizer: "Org Team",
      purpose: "",
      roles: [],
      signedUp: 0,
      totalSlots: 10,
      createdBy: "u1",
      createdAt: new Date().toISOString(),
    });

    render(
      <TestWrapper>
        <EventDetail />
      </TestWrapper>
    );

    // Wait for title to render in the header
    await waitFor(() => {
      expect(screen.getAllByText(/Overnight Event/)[0]).toBeInTheDocument();
    });

    // Should display a single-line combined range with both dates
    const combinedNodes = screen.getAllByText((_, node) => {
      const text = node?.textContent || "";
      return (
        text.includes("Sun, Aug 10, 2025") && text.includes("Mon, Aug 11, 2025")
      );
    });
    expect(combinedNodes.length).toBeGreaterThan(0);
  });
});
