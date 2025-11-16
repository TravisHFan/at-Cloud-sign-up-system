import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import FlyerDisplay from "../../../components/EventDetail/FlyerDisplay";
import type { EventData } from "../../../types/event";

// Mock FlyerCarousel component
vi.mock("../../../components/events/FlyerCarousel", () => ({
  default: ({ flyerUrl, secondaryFlyerUrl }: any) => (
    <div data-testid="flyer-carousel">
      {flyerUrl && <div data-testid="primary-flyer">{flyerUrl}</div>}
      {secondaryFlyerUrl && (
        <div data-testid="secondary-flyer">{secondaryFlyerUrl}</div>
      )}
    </div>
  ),
}));

const mockEvent = {
  flyerUrl: "https://example.com/flyer.jpg",
  secondaryFlyerUrl: undefined,
} as EventData;

describe("FlyerDisplay", () => {
  it("renders nothing when no flyer URLs are provided", () => {
    const eventNoFlyers = {
      flyerUrl: undefined,
      secondaryFlyerUrl: undefined,
    } as EventData;

    const { container } = render(<FlyerDisplay event={eventNoFlyers} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders with single flyer", () => {
    render(<FlyerDisplay event={mockEvent} />);

    expect(screen.getByText("Event Flyer")).toBeDefined();
    expect(screen.getByTestId("flyer-carousel")).toBeDefined();
  });

  it("renders singular 'Flyer' when only primary flyer exists", () => {
    const eventOneFlyerOnly = {
      flyerUrl: "https://example.com/flyer.jpg",
      secondaryFlyerUrl: undefined,
    } as EventData;

    render(<FlyerDisplay event={eventOneFlyerOnly} />);
    const heading = screen.getByText("Event Flyer");
    expect(heading.textContent).toBe("Event Flyer");
  });

  it("renders plural 'Flyers' when both flyers exist", () => {
    const eventTwoFlyers = {
      flyerUrl: "https://example.com/primary.jpg",
      secondaryFlyerUrl: "https://example.com/secondary.jpg",
    } as EventData;

    render(<FlyerDisplay event={eventTwoFlyers} />);
    const heading = screen.getByText("Event Flyers");
    expect(heading.textContent).toBe("Event Flyers");
  });

  it("renders with only secondary flyer", () => {
    const eventSecondaryOnly = {
      flyerUrl: undefined,
      secondaryFlyerUrl: "https://example.com/secondary.jpg",
    } as EventData;

    render(<FlyerDisplay event={eventSecondaryOnly} />);
    expect(screen.getByText("Event Flyer")).toBeDefined();
    expect(screen.getByTestId("flyer-carousel")).toBeDefined();
  });

  it("passes flyer URLs to FlyerCarousel", () => {
    const eventWithBoth = {
      flyerUrl: "https://example.com/primary.jpg",
      secondaryFlyerUrl: "https://example.com/secondary.jpg",
    } as EventData;

    render(<FlyerDisplay event={eventWithBoth} />);
    expect(screen.getByTestId("primary-flyer")).toBeDefined();
    expect(screen.getByTestId("secondary-flyer")).toBeDefined();
  });
});
