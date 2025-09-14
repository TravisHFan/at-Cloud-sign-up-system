/**
 * Deterministic local time conversion test.
 * Forces process.env.TZ to America/Los_Angeles to ensure 15:00 America/New_York => 12:00 viewer local.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock Auth before component import
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    hasRole: () => true,
    currentUser: { id: "u1", role: "Administrator" },
    isAuthenticated: true,
    isLoading: false,
  }),
}));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    hasRole: () => true,
    currentUser: { id: "u1", role: "Administrator" },
    isAuthenticated: true,
    isLoading: false,
  }),
}));
import SystemMessages from "./SystemMessages";

// Force timezone BEFORE any date usage (guard for environments without process typings)
try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).process = (globalThis as any).process || {}; // ensure object
  (globalThis as any).process.env = (globalThis as any).process.env || {};
  (globalThis as any).process.env.TZ = "America/Los_Angeles";
} catch {
  // ignore if cannot set
}

// Mock notification context with a single Role Invited message.
vi.mock("../contexts/NotificationContext", () => ({
  useNotifications: () => ({
    systemMessages: [],
    markSystemMessageAsRead: vi.fn(),
    reloadSystemMessages: vi.fn(),
  }),
}));
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ hash: "", pathname: "/dashboard/system-messages" }),
}));
vi.mock("../services/systemMessageService", () => ({
  systemMessageService: {
    getSystemMessagesPaginated: vi.fn().mockResolvedValue({
      messages: [
        {
          id: "m1",
          title: "Role Invited",
          content:
            'Alice Admin invited you to the role: Greeter for event "Community Meetup".\n\nEvent Time: 2025-10-02 • 15:00 (America/New_York)\n\nIf you accept this invitation, no action is required.\nIf you need to decline this invitation, please use the Decline Invitation button below or the link provided in your email.',
          type: "event_role_change",
          priority: "medium",
          createdAt: "2025-09-01T00:00:00.000Z",
          isRead: false,
          metadata: {
            eventId: "evt1",
            eventDetailUrl: "/dashboard/event/evt1",
            rejectionLink: "/assignments/reject?token=abc",
            timing: {
              originalDate: "2025-10-02",
              originalTime: "15:00",
              originalTimeZone: "America/New_York",
              // Correct UTC for 15:00 EDT (UTC-4) => 19:00Z
              eventDateTimeUtc: "2025-10-02T19:00:00.000Z",
            },
          },
          creator: {
            id: "admin1",
            firstName: "Alice",
            lastName: "Admin",
            roleInAtCloud: "Leader",
            authLevel: "Administrator",
            avatar: "",
            gender: "female",
          },
        },
      ],
      pagination: { currentPage: 1, totalPages: 1, totalCount: 1 },
    }),
  },
}));

describe("SystemMessages deterministic local time conversion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows 12:00 (your local time) for 15:00 America/New_York when viewer TZ = America/Los_Angeles", async () => {
    render(<SystemMessages />);
    const para = await screen.findByText(/Alice Admin invited you/, {
      exact: false,
    });
    // The replacement line should now show 12:00 (Pacific) not 08:00.
    expect(para.textContent).toMatch(
      /Event Time: 2025-10-02 • 12:00 \(your local time\)/
    );
  });
});
