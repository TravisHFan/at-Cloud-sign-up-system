import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PublishGateBanner } from "../../components/publish/PublishGateBanner";
import { PublishButton } from "../../components/publish/PublishButton";

// Basic smoke tests for gating components

describe("Publish gating UI components", () => {
  it("renders banner with missing fields list", () => {
    render(
      <PublishGateBanner
        event={{ format: "Online", zoomLink: "", meetingId: "", passcode: "" }}
      />
    );
    const banner = screen.getByTestId("publish-gate-banner");
    expect(banner).toBeTruthy();
    expect(banner.textContent).toMatch(/Zoom Link/i);
    expect(banner.textContent).toMatch(/Meeting ID/i);
    expect(banner.textContent).toMatch(/Passcode/i);
  });

  it("disables publish button and shows hint when missing fields", () => {
    render(
      <PublishButton
        event={{ format: "In-person", location: "" }}
        onPublish={() => {}}
      />
    );
    const btn = screen.getByTestId("publish-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    const hint = screen.getByTestId("publish-button-hint");
    expect(hint.textContent).toMatch(/Location/);
  });

  it("enables publish button when all fields present", () => {
    render(
      <PublishButton
        event={{
          format: "Hybrid Participation",
          location: "Campus Center",
          zoomLink: "https://zoom.example/hybrid",
          meetingId: "MEET1",
          passcode: "CODE",
        }}
        onPublish={() => {}}
      />
    );
    const btn = screen.getByTestId("publish-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });
});
