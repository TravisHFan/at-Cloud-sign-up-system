import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("../../services/api", () => ({
  apiClient: {
    getEvent: vi.fn(),
  },
}));

import { apiClient } from "../../services/api";
import GuestRegistration from "../../pages/GuestRegistration";

describe("GuestRegistration role description display", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const event = {
    id: "e1",
    title: "Community Event",
    type: "Hybrid Service",
    roles: [
      {
        id: "r1",
        name: "Prepared Speaker (on-site)",
        description:
          "Prepare a 5-minute talk about your topic.\nArrive 15 mins early.",
      },
      {
        id: "r2",
        name: "Common Participant (on-site)",
        description: "Attend and participate in group activities.",
      },
    ],
  } as any;

  const renderForEvent = async () => {
    (apiClient.getEvent as any).mockResolvedValue(event);
    render(
      <MemoryRouter initialEntries={[`/guest-register/${event.id}`]}>
        <Routes>
          <Route path="/guest-register/:id" element={<GuestRegistration />} />
        </Routes>
      </MemoryRouter>
    );
    return screen.findByLabelText(/Pick a role to participate in:/i);
  };

  it("shows the selected role's description and updates when selection changes", async () => {
    const select = (await renderForEvent()) as HTMLSelectElement;

    // On initial render, first allowed role should be selected automatically
    const initialDesc = await screen.findByTestId("guest-role-description");
    expect(initialDesc).toHaveTextContent(
      "Prepare a 5-minute talk about your topic."
    );
    expect(initialDesc).toHaveTextContent("Arrive 15 mins early.");

    // Change selection to second role
    fireEvent.change(select, { target: { value: "r2" } });

    const updatedDesc = await screen.findByTestId("guest-role-description");
    expect(updatedDesc).toHaveTextContent(
      "Attend and participate in group activities."
    );
  });
});
