import { describe, it, expect, vi, beforeEach } from "vitest";
// Minimal process typing for test environment if @types/node not applied to vitest globals
declare const process: any;
import { render, screen } from "@testing-library/react";
import { formatViewerLocalDateTime } from "../utils/timezoneUtils";
import { mockAuthContext } from "../test/test-utils/mockAuth";

// Force a deterministic viewer timezone for these tests (UTC chosen for stability)
// Must set before any date formatting happens.
process.env.TZ = "UTC";

// Install consolidated auth mocks (will be effective for dynamic imports)
mockAuthContext({ currentUser: { id: "u1", role: "Administrator" } });

async function renderSystemMessages() {
  const { default: SystemMessages } = await import("./SystemMessages");
  render(<SystemMessages />);
}

// Mock dependencies
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
            'Alice Admin invited you to the role: Greeter for event "Community Meetup".\n\nEvent Time: 2025-03-29 • 15:30 (America/New_York)\n\nIf you accept this invitation, no action is required.\nIf you need to decline this invitation, please use the Decline Invitation button below or the link provided in your email.',
          type: "event_role_change",
          priority: "medium",
          createdAt: new Date().toISOString(),
          isRead: false,
          metadata: {
            eventId: "evt1",
            eventDetailUrl: "/dashboard/event/evt1",
            rejectionLink: "/assignments/reject?token=abc",
            timing: {
              originalDate: "2025-03-29",
              originalTime: "15:30",
              originalTimeZone: "America/New_York",
              eventDateTimeUtc: "2025-03-29T19:30:00.000Z",
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

// Helper to patch Intl for deterministic test? Rely on environment local timezone.

describe("SystemMessages local time replacement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replaces Event Time line with viewer local time marker and derives from UTC anchor", async () => {
    await renderSystemMessages();
    // Wait for the content to appear
    const paragraph = await screen.findByText(/Alice Admin invited you/, {
      exact: false,
    });
    expect(paragraph.textContent).toContain("Event Time: 2025-03-29");
    // Ensure the line now contains the marker '(your local time)'
    expect(paragraph.textContent).toMatch(/\(your local time\)/);
    // Ensure original source zone label removed
    expect(paragraph.textContent).not.toMatch(/America\/New_York/);
    // Defensive: UTC anchor 19:30Z => viewer HH:30; assert we kept :30 minutes
    expect(paragraph.textContent).toMatch(/\b\d{2}:30 \(your local time\)/);
    // Additional defensive assertion: recompute expected viewer-local time via util
    const recomputed = formatViewerLocalDateTime({
      date: "2025-03-29",
      time: "15:30",
      timeZone: "America/New_York",
      eventDateTimeUtc: "2025-03-29T19:30:00.000Z",
    });
    expect(recomputed).not.toBeNull();
    if (recomputed) {
      expect(paragraph.textContent).toMatch(
        new RegExp(`\\b${recomputed.time} \\(your local time\\)`) // ensure the exact HH:mm appears
      );
    }
  });

  it("renders CTA buttons for Role Invited message", async () => {
    await renderSystemMessages();
    const viewBtn = await screen.findByRole("link", {
      name: /See the Event & Role Details/i,
    });
    const declineBtn = await screen.findByRole("link", {
      name: /Decline This Invitation/i,
    });
    expect(viewBtn).toBeInTheDocument();
    expect(declineBtn).toBeInTheDocument();
  });

  it("handles early-morning DST boundary using UTC anchor (03:15 America/New_York -> 07:15Z)", async () => {
    // Ensure a clean module graph so previous service mock isn't cached
    vi.resetModules();
    mockAuthContext({ currentUser: { id: "u1", role: "Administrator" } });
    const getSystemMessagesPaginated = vi.fn().mockResolvedValue({
      messages: [
        {
          id: "m2",
          title: "Role Invited",
          content:
            'Alice Admin invited you to the role: Greeter for event "Sunrise Meetup".\n\nEvent Time: 2025-06-10 • 03:15 (America/New_York)\n\nIf you accept this invitation, no action is required.\nIf you need to decline this invitation, please use the Decline Invitation button below or the link provided in your email.',
          type: "event_role_change",
          priority: "medium",
          createdAt: new Date().toISOString(),
          isRead: false,
          metadata: {
            eventId: "evt2",
            eventDetailUrl: "/dashboard/event/evt2",
            rejectionLink: "/assignments/reject?token=def",
            timing: {
              originalDate: "2025-06-10",
              originalTime: "03:15",
              originalTimeZone: "America/New_York",
              eventDateTimeUtc: "2025-06-10T07:15:00.000Z",
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
    });
    vi.doMock("../services/systemMessageService", () => ({
      systemMessageService: { getSystemMessagesPaginated },
    }));
    // Dynamically import AFTER mocks
    const { default: SystemMessages } = await import("./SystemMessages");
    render(<SystemMessages />);
    const para = await screen.findByText(/Sunrise Meetup|Sunrise\s+Meetup/, {
      exact: false,
    });
    expect(para.textContent).toContain("Event Time: 2025-06-10");
    expect(para.textContent).toMatch(/\(your local time\)/);
    // Minutes preserved from UTC anchor conversion
    expect(para.textContent).toMatch(/\b\d{2}:15 \(your local time\)/);
  });

  it("handles spring-forward missing hour (02:30 nonexistent in America/New_York)", async () => {
    // Spring forward 2025: clocks jump from 01:59:59 to 03:00:00 local (America/New_York on 2025-03-09)
    // Backend provides authoritative UTC anchor for intended local 02:30 (interpreted as post-jump 03:30 EDT => 07:30Z)
    vi.resetModules();
    mockAuthContext({ currentUser: { id: "u1", role: "Administrator" } });
    const getSystemMessagesPaginated = vi.fn().mockResolvedValue({
      messages: [
        {
          id: "mSpring",
          title: "Role Invited",
          content:
            'Alice Admin invited you to the role: Greeter for event "Spring Forward Meetup".\n\nEvent Time: 2025-03-09 • 02:30 (America/New_York)\n\nIf you accept this invitation, no action is required.\nIf you need to decline this invitation, please use the Decline Invitation button below or the link provided in your email.',
          type: "event_role_change",
          priority: "medium",
          createdAt: new Date().toISOString(),
          isRead: false,
          metadata: {
            eventId: "evtSpring",
            eventDetailUrl: "/dashboard/event/evtSpring",
            rejectionLink: "/assignments/reject?token=spring",
            timing: {
              originalDate: "2025-03-09",
              originalTime: "02:30",
              originalTimeZone: "America/New_York",
              eventDateTimeUtc: "2025-03-09T07:30:00.000Z", // Intended real occurrence after jump (03:30 EDT)
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
    });
    vi.doMock("../services/systemMessageService", () => ({
      systemMessageService: { getSystemMessagesPaginated },
    }));
    const { default: SystemMessages } = await import("./SystemMessages");
    render(<SystemMessages />);
    const para = await screen.findByText(/Spring Forward Meetup/, {
      exact: false,
    });
    expect(para.textContent).toMatch(/\(your local time\)/);
    const expected = formatViewerLocalDateTime({
      date: "2025-03-09",
      time: "02:30",
      timeZone: "America/New_York",
      eventDateTimeUtc: "2025-03-09T07:30:00.000Z",
    });
    expect(expected).not.toBeNull();
    if (expected) {
      // Assert the viewer-local date appears (may differ from original if crossing midnight)
      expect(para.textContent).toContain(`Event Time: ${expected.date}`);
      expect(para.textContent).toMatch(
        new RegExp(`\\b${expected.time} \\(your local time\\)`)
      );
    }
  });

  it("handles fall DST ambiguous hour (01:30 repeated - selecting EST instance)", async () => {
    vi.resetModules();
    mockAuthContext({ currentUser: { id: "u1", role: "Administrator" } });
    const getSystemMessagesPaginated = vi.fn().mockResolvedValue({
      messages: [
        {
          id: "mFall",
          title: "Role Invited",
          content:
            'Alice Admin invited you to the role: Greeter for event "Fallback Event".\n\nEvent Time: 2025-11-02 • 01:30 (America/New_York)\n\nIf you accept this invitation, no action is required.\nIf you need to decline this invitation, please use the Decline Invitation button below or the link provided in your email.',
          type: "event_role_change",
          priority: "medium",
          createdAt: new Date().toISOString(),
          isRead: false,
          metadata: {
            eventId: "evtFall",
            eventDetailUrl: "/dashboard/event/evtFall",
            rejectionLink: "/assignments/reject?token=fall",
            timing: {
              originalDate: "2025-11-02",
              originalTime: "01:30",
              originalTimeZone: "America/New_York",
              eventDateTimeUtc: "2025-11-02T06:30:00.000Z", // EST instance (UTC-5)
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
    });
    vi.doMock("../services/systemMessageService", () => ({
      systemMessageService: { getSystemMessagesPaginated },
    }));
    const { default: SystemMessages } = await import("./SystemMessages");
    render(<SystemMessages />);
    const para = await screen.findByText(/Fallback Event/, { exact: false });
    expect(para.textContent).toMatch(/\(your local time\)/);
    const expected = formatViewerLocalDateTime({
      date: "2025-11-02",
      time: "01:30",
      timeZone: "America/New_York",
      eventDateTimeUtc: "2025-11-02T06:30:00.000Z",
    });
    expect(expected).not.toBeNull();
    if (expected) {
      // Assert the viewer-local date appears (may differ from original if crossing midnight)
      expect(para.textContent).toContain(`Event Time: ${expected.date}`);
      expect(para.textContent).toMatch(
        new RegExp(`\\b${expected.time} \\(your local time\\)`)
      );
    }
  });
});
