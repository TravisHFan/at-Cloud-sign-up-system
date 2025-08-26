import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("../../services/api", () => ({
  apiClient: {
    getEvent: vi.fn(),
  },
}));

import { apiClient } from "../../services/api";
import GuestRegistration from "../../pages/GuestRegistration";

describe("GuestRegistration participant-allowed roles visibility", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const renderForEvent = async (eventData: any) => {
    (apiClient.getEvent as any).mockResolvedValue(eventData);
    render(
      <MemoryRouter initialEntries={[`/guest-register/${eventData.id}`]}>
        <Routes>
          <Route path="/guest-register/:id" element={<GuestRegistration />} />
        </Routes>
      </MemoryRouter>
    );
    // Wait for the role select to appear (if any roles qualify)
    return screen.findByLabelText(/Pick a role to participate in:/i);
  };

  it("shows only participant-level roles for non-workshop events", async () => {
    const event = {
      id: "e-nonws",
      title: "Community Event",
      type: "Hybrid Service", // any non-workshop
      roles: [
        { id: "a1", name: "Prepared Speaker (on-site)", description: "" },
        { id: "a2", name: "Prepared Speaker (Zoom)", description: "" },
        { id: "a3", name: "Common Participant (on-site)", description: "" },
        { id: "a4", name: "Common Participant (Zoom)", description: "" },
        // non-participant roles should be hidden from guests
        { id: "x1", name: "Greeter", description: "" },
        { id: "x2", name: "Usher", description: "" },
      ],
    };

    const select = (await renderForEvent(event)) as HTMLSelectElement;
    const options = within(select).getAllByRole(
      "option"
    ) as HTMLOptionElement[];
    // Exclude the placeholder option (disabled, empty value)
    const visibleOptions = options.filter((o) => !o.disabled && !!o.value);
    const labels = visibleOptions.map((o) => o.textContent?.trim());

    expect(labels).toEqual([
      "Prepared Speaker (on-site)",
      "Prepared Speaker (Zoom)",
      "Common Participant (on-site)",
      "Common Participant (Zoom)",
    ]);
    expect(labels).not.toContain("Greeter");
    expect(labels).not.toContain("Usher");
  });

  it("shows only participant-level group roles for Effective Communication Workshop", async () => {
    const event = {
      id: "e-ws",
      title: "EC Workshop",
      type: "Effective Communication Workshop",
      roles: [
        { id: "gA2", name: "Group A Participants", description: "" },
        { id: "gB2", name: "Group B Participants", description: "" },
        // Non-participant workshop roles not visible to guests
        { id: "wx1", name: "Workshop Admin", description: "" },
        { id: "wx2", name: "Speaker", description: "" },
      ],
    };

    const select = (await renderForEvent(event)) as HTMLSelectElement;
    const options = within(select).getAllByRole(
      "option"
    ) as HTMLOptionElement[];
    const visibleOptions = options.filter((o) => !o.disabled && !!o.value);
    const labels = visibleOptions.map((o) => o.textContent?.trim());

    expect(labels).toEqual(["Group A Participants", "Group B Participants"]);
    expect(labels).not.toContain("Workshop Admin");
    expect(labels).not.toContain("Speaker");
    expect(labels).not.toContain("Group A Leader");
    expect(labels).not.toContain("Group B Leader");
  });
});
