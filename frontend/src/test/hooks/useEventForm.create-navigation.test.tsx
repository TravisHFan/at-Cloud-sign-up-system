import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEventForm } from "../../hooks/useEventForm";

const mockedEventService = vi.hoisted(() => ({
  createEvent: vi.fn(),
  checkEventTimeConflict: vi
    .fn()
    .mockResolvedValue({ conflict: false, conflicts: [] }),
}));

const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

vi.mock("../../services/api", () => ({
  eventService: mockedEventService,
}));

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    currentUser: {
      id: "admin1",
      role: "Administrator",
    },
  }),
}));

vi.mock("../../contexts/NotificationModalContext", () => ({
  useToastReplacement: () => ({
    success: toastSuccess,
    error: toastError,
  }),
}));

const validEventData = {
  title: "Created Event",
  type: "Conference",
  date: "2026-06-01",
  endDate: "2026-06-01",
  time: "10:00",
  endTime: "11:00",
  organizer: "Events Team",
  agenda: "Welcome and close",
  format: "Online",
  hostedBy: "@Cloud Marketplace Ministry",
  location: "",
  zoomLink: "",
  meetingId: "",
  passcode: "",
  timeZone: "America/Los_Angeles",
  roles: [],
  pricing: {
    isFree: true,
  },
};

describe("useEventForm create success navigation", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...originalLocation, href: "" },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    });
  });

  it("wires View Event to the newly created event detail page", async () => {
    mockedEventService.createEvent.mockResolvedValueOnce({
      id: "evt-created-1",
    });
    const { result } = renderHook(() => useEventForm());

    act(() => {
      result.current.form.reset(validEventData as any);
    });

    await act(async () => {
      await result.current.onSubmit({ preventDefault: vi.fn() } as any);
    });

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    const toastOptions = toastSuccess.mock.calls[0][1];

    expect(toastOptions.actionButton.text).toBe("View Event");
    toastOptions.actionButton.onClick();

    expect(window.location.href).toBe("/dashboard/event/evt-created-1");
  });

  it("uses the first returned event id for recurring event creation", async () => {
    mockedEventService.createEvent.mockResolvedValueOnce({
      _id: "evt-recurring-first",
    });
    const { result } = renderHook(() =>
      useEventForm(undefined, {
        isRecurring: true,
        frequency: "weekly",
        occurrenceCount: 3,
        recurrenceMode: "same-weekday",
      }),
    );

    act(() => {
      result.current.form.reset(validEventData as any);
    });

    await act(async () => {
      await result.current.onSubmit({ preventDefault: vi.fn() } as any);
    });

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());

    expect(mockedEventService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        recurring: expect.objectContaining({
          isRecurring: true,
          frequency: "weekly",
          occurrenceCount: 3,
        }),
      }),
    );

    const toastOptions = toastSuccess.mock.calls[0][1];
    toastOptions.actionButton.onClick();

    expect(window.location.href).toBe("/dashboard/event/evt-recurring-first");
  });

  it("does not create when overlap confirmation is cancelled", async () => {
    const confirmTimeOverlap = vi.fn().mockResolvedValue(false);
    mockedEventService.checkEventTimeConflict.mockResolvedValueOnce({
      conflict: true,
      conflicts: [{ id: "event-1", title: "Existing Event" }],
    });

    const { result } = renderHook(() =>
      useEventForm(undefined, undefined, { confirmTimeOverlap }),
    );

    act(() => {
      result.current.form.reset(validEventData as any);
    });

    await act(async () => {
      await result.current.onSubmit({ preventDefault: vi.fn() } as any);
    });

    expect(confirmTimeOverlap).toHaveBeenCalledWith([
      { id: "event-1", title: "Existing Event" },
    ]);
    expect(mockedEventService.createEvent).not.toHaveBeenCalled();
  });

  it("creates when overlap confirmation is accepted", async () => {
    const confirmTimeOverlap = vi.fn().mockResolvedValue(true);
    mockedEventService.checkEventTimeConflict.mockResolvedValueOnce({
      conflict: true,
      conflicts: [{ id: "event-1", title: "Existing Event" }],
    });
    mockedEventService.createEvent.mockResolvedValueOnce({ id: "evt-created" });

    const { result } = renderHook(() =>
      useEventForm(undefined, undefined, { confirmTimeOverlap }),
    );

    act(() => {
      result.current.form.reset(validEventData as any);
    });

    await act(async () => {
      await result.current.onSubmit({ preventDefault: vi.fn() } as any);
    });

    expect(confirmTimeOverlap).toHaveBeenCalled();
    expect(mockedEventService.createEvent).toHaveBeenCalled();
  });
});
