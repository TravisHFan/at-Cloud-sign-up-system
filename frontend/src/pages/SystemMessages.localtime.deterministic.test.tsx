/**
 * Deterministic local time conversion test.
 * Forces process.env.TZ to America/Los_Angeles to ensure 15:00 America/New_York => 12:00 viewer local.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { mockAuthContext } from "../test/test-utils/mockAuth";
import { buildRoleInvitedMessage } from "../test/test-utils/systemMessageBuilder";

mockAuthContext({ currentUser: { id: "u1", role: "Administrator" } });
async function renderSystemMessages() {
  const { default: SystemMessages } = await import("./SystemMessages");
  render(<SystemMessages />);
}

// Force timezone BEFORE any date usage (guard for environments without process typings)
try {
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
vi.mock("../services/systemMessageService", () => {
  const msg = buildRoleInvitedMessage({
    id: "m1",
    date: "2025-10-02",
    time: "15:00",
    timeZone: "America/New_York",
    utc: "2025-10-02T19:00:00.000Z",
    eventId: "evt1",
    eventTitle: "Community Meetup",
    createdAt: "2025-09-01T00:00:00.000Z",
  });
  return {
    systemMessageService: {
      getSystemMessagesPaginated: vi.fn().mockResolvedValue({
        messages: [msg],
        pagination: { currentPage: 1, totalPages: 1, totalCount: 1 },
      }),
    },
  };
});

describe("SystemMessages deterministic local time conversion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows 12:00 (your local time) for 15:00 America/New_York when viewer TZ = America/Los_Angeles", async () => {
    await renderSystemMessages();
    const para = await screen.findByText(/Alice Admin invited you/, {
      exact: false,
    });
    // The replacement line should now show 12:00 (Pacific) not 08:00.
    expect(para.textContent).toMatch(
      /Event Time: 2025-10-02 • 12:00 \(your local time\)/
    );
  });
});
