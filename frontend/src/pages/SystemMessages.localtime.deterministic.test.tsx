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

  it("handles fall DST ambiguous hour (01:30 America/New_York after fallback)", async () => {
    vi.resetModules();
    mockAuthContext({ currentUser: { id: "u1", role: "Administrator" } });
    const ambiguous = buildRoleInvitedMessage({
      id: "mDST",
      date: "2025-11-02", // US fallback date 2025
      time: "01:30", // occurs twice (EDT then EST); backend supplies authoritative UTC after fallback -> assume EST (UTC-5)
      timeZone: "America/New_York",
      utc: "2025-11-02T06:30:00.000Z", // 01:30 EST => 06:30Z
      eventId: "evtDST",
      eventTitle: "Fallback Event",
    });
    vi.doMock("../services/systemMessageService", () => ({
      systemMessageService: {
        getSystemMessagesPaginated: vi.fn().mockResolvedValue({
          messages: [ambiguous],
          pagination: { currentPage: 1, totalPages: 1, totalCount: 1 },
        }),
      },
    }));
    await renderSystemMessages();
    const para = await screen.findByText(/Fallback Event/, { exact: false });
    expect(para.textContent).toContain("Event Time: 2025-11-02");
    expect(para.textContent).toMatch(/\(your local time\)/);
    // Minutes preserved
    expect(para.textContent).toMatch(/\b\d{2}:30 \(your local time\)/);
  });
});
