import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
// Use the Vitest-specific adapter so jest-dom registers matchers with Vitest's expect safely.
import "@testing-library/jest-dom/vitest";
import EventListItem from "../../../components/events/EventListItem";
import type { EventData } from "../../../types/event";

vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({ currentUser: undefined }),
}));

function buildEvent(overrides: Partial<EventData>): EventData {
  return {
    id: "e1",
    title: "Boundary Event",
    type: "general",
    date: "2025-08-11",
    time: "12:00",
    endTime: "13:00",
    endDate: undefined,
    timeZone: "UTC",
    location: "Hall",
    organizer: "Org",
    format: "in-person",
    roles: [],
    signedUp: 0,
    totalSlots: 10,
    createdBy: "u1",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("EventListItem ongoing badge boundaries", () => {
  const baseNow = new Date("2025-08-11T11:59:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const renderItem = (evt: EventData) => {
    return render(
      <EventListItem
        event={evt}
        type={evt.status === "completed" ? "passed" : "upcoming"}
      />
    );
  };

  it("does not show ongoing badge before start", () => {
    renderItem(buildEvent({}));
    expect(screen.queryByText(/Ongoing/i)).toBeNull();
  });

  it("shows ongoing badge at start instant", () => {
    vi.setSystemTime(new Date("2025-08-11T12:00:00Z"));
    renderItem(buildEvent({}));
    expect(screen.getByText(/Ongoing/i)).toBeInTheDocument();
  });

  it("shows ongoing badge one minute before end", () => {
    vi.setSystemTime(new Date("2025-08-11T12:59:00Z"));
    renderItem(buildEvent({}));
    expect(screen.getByText(/Ongoing/i)).toBeInTheDocument();
  });

  it("hides ongoing badge exactly at end (exclusive)", () => {
    vi.setSystemTime(new Date("2025-08-11T13:00:00Z"));
    renderItem(buildEvent({}));
    expect(screen.queryByText(/Ongoing/i)).toBeNull();
  });

  it("respects backend provided ongoing status overriding local calc", () => {
    // Provide status=ongoing but set system time before start to ensure status wins
    vi.setSystemTime(new Date("2025-08-11T11:30:00Z"));
    renderItem(buildEvent({ status: "ongoing" }));
    expect(screen.getByText(/Ongoing/i)).toBeInTheDocument();
  });

  it("supports multi-day event with endDate later", () => {
    vi.setSystemTime(new Date("2025-08-12T12:00:00Z"));
    renderItem(
      buildEvent({
        date: "2025-08-11",
        endDate: "2025-08-13",
        time: "09:00",
        endTime: "17:00",
      })
    );
    expect(screen.getByText(/Ongoing/i)).toBeInTheDocument();
  });
});
