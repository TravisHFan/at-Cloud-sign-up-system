/**
 * Integration-oriented test: uses backend-like UTC calculation expectations.
 * Verifies that when backend supplies eventDateTimeUtc for a Role Invited message,
 * the frontend replaces Event Time line with the viewer-local conversion and does NOT
 * regress to incorrect naive interpretation (e.g., showing 08:00 instead of 12:00).
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

// Force viewer TZ to America/Los_Angeles
try {
  (globalThis as any).process = (globalThis as any).process || {};
  (globalThis as any).process.env = (globalThis as any).process.env || {};
  (globalThis as any).process.env.TZ = "America/Los_Angeles";
} catch {}

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
  // Backend now computes correct UTC 2025-10-02T19:00:00.000Z for 15:00 America/New_York
  const msg = buildRoleInvitedMessage({
    id: "mUtc1",
    date: "2025-10-02",
    time: "15:00",
    timeZone: "America/New_York",
    utc: "2025-10-02T19:00:00.000Z",
    eventId: "evtUtc1",
    eventTitle: "UTC Supply Test",
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

describe("SystemMessages backend-supplied UTC integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 12:00 local time using backend UTC anchor (regression guard)", async () => {
    await renderSystemMessages();
    const para = await screen.findByText(/Alice Admin invited you/, {
      exact: false,
    });
    expect(para.textContent).toMatch(
      /Event Time: 2025-10-02 • 12:00 \(your local time\)/
    );
  });
});
