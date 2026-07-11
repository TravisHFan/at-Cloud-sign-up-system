import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEvents } from "../../hooks/useEventsApi";

const { getEventsMock, notification } = vi.hoisted(() => ({
  getEventsMock: vi.fn(),
  notification: { error: vi.fn() },
}));

vi.mock("../../services/api", () => ({
  eventService: {
    getEvents: getEventsMock,
  },
}));

vi.mock("../../contexts/NotificationModalContext", () => ({
  useToastReplacement: () => notification,
}));

describe("useEvents summary counts", () => {
  beforeEach(() => {
    getEventsMock.mockReset();
    notification.error.mockReset();
  });

  it("uses batched list totals without requiring participant records", async () => {
    getEventsMock.mockResolvedValue({
      events: [
        {
          id: "event-1",
          title: "Fast list event",
          type: "Conference",
          date: "2099-01-01",
          endDate: "2099-01-01",
          time: "10:00",
          endTime: "11:00",
          location: "Main hall",
          organizer: "@Cloud",
          format: "In-person",
          status: "upcoming",
          signedUp: 3,
          totalSlots: 5,
          createdBy: "creator-1",
          createdAt: "2026-01-01T00:00:00.000Z",
          roles: [
            {
              id: "attendee",
              name: "Attendee",
              description: "",
              maxParticipants: 5,
              currentCount: 3,
              currentSignups: [],
            },
          ],
        },
      ],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalEvents: 1,
        hasNext: false,
        hasPrev: false,
      },
    });

    const { result } = renderHook(() => useEvents());

    await waitFor(() => expect(result.current.events).toHaveLength(1));

    expect(result.current.events[0]).toMatchObject({
      signedUp: 3,
      totalSlots: 5,
    });
    expect(result.current.events[0].roles[0].currentSignups).toEqual([]);
  });
});
