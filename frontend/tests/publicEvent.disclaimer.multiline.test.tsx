import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import PublicEvent from "../src/pages/PublicEvent";

// Mock react-router & api client used in PublicEvent
vi.mock("react-router-dom", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    useParams: () => ({ slug: "public-event-slug" }),
    useNavigate: () => vi.fn(),
    Link: ({ children }: any) => <>{children}</>,
  };
});

vi.mock("../src/services/api", () => {
  const apiClient = {
    getPublicEvent: async () => ({
      id: "pub1",
      slug: "public-event-slug",
      title: "Public Event",
      purpose: "Purpose first line\nPurpose second line",
      disclaimer: "Disclaimer line 1\nDisclaimer line 2\nDisclaimer line 3",
      agenda: "",
      roles: [],
      start: new Date().toISOString(),
      end: new Date().toISOString(),
      date: "2025-01-01",
      endDate: null,
      time: "09:00",
      endTime: "10:00",
      timeZone: "America/New_York",
      location: "Room 1",
      format: "In-Person",
      hostedBy: "Org",
      flyerUrl: "",
    }),
  };
  return { __esModule: true, default: apiClient, apiClient };
});

describe("PublicEvent disclaimer multiline rendering", () => {
  it("renders disclaimer with preserved line breaks", async () => {
    render(<PublicEvent />);
    // Wait for loading to resolve and disclaimer to appear
    const disclaimer = await screen.findByTestId("public-event-disclaimer");
    const text = disclaimer.textContent || "";
    expect(text).toContain("Disclaimer line 1");
    expect(text).toContain("Disclaimer line 2");
    expect(text).toContain("Disclaimer line 3");
  });
});
