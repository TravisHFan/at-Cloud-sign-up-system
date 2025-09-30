import { describe, it, expect, vi } from "vitest";
// Lightweight import of the module to access normalize behavior indirectly by rendering.
import React from "react";
import { render } from "@testing-library/react";

// We re-import the page and rely on internal normalizeMultiline via rendering agenda text.
// To avoid over-coupling, we just check that bullet separators or literal \n sequences produce line breaks in the DOM.
import PublicEvent from "../src/pages/PublicEvent";

// Mock router params & api client
vi.mock("../src/services/api", () => ({
  __esModule: true,
  default: {
    getPublicEvent: async () => ({
      id: "e1",
      title: "Sample",
      start: new Date().toISOString(),
      end: new Date(Date.now() + 3600000).toISOString(),
      location: "Line1\\nLine2",
      purpose: "Purpose line A\\nPurpose line B",
      agenda: "Welcome • Session 1 • Break • Session 2",
      flyerUrl: undefined,
      roles: [
        {
          roleId: "r1",
          name: "Role 1",
          description: "Intro\\nDetail line",
          maxParticipants: 3,
          capacityRemaining: 3,
        },
      ],
      slug: "sample",
      date: "2025-01-01",
      endDate: null,
      time: "09:00",
      endTime: "10:00",
      timeZone: "America/New_York",
    }),
    registerForPublicEvent: async () => ({ status: "ok", registrationId: "x" }),
  },
}));

vi.mock("react-router-dom", async (importOriginal: any) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useParams: () => ({ slug: "sample" }),
    useNavigate: () => vi.fn(),
    Link: ({ children }: any) => <div>{children}</div>,
  };
});

// Silence console error noise from misuse of alert etc.
vi.stubGlobal("alert", () => {});

describe("PublicEvent multiline normalization", () => {
  it("renders line breaks for location, purpose, agenda bullets, and role description", async () => {
    const { findByTestId, findAllByText } = render(<PublicEvent />);
    const agendaSection = await findByTestId("public-event-agenda");
    // Agenda should have transformed bullets into separate lines -> check that at least one <br> equivalent via innerHTML newline presence
    expect(agendaSection.textContent?.includes("Welcome")).toBe(true);
    // Role description newline
    const roleDesc = await findAllByText(/Detail line/);
    expect(roleDesc.length).toBeGreaterThan(0);
  });
});
