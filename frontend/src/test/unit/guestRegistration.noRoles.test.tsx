import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("../../services/api", () => ({
  apiClient: {
    getEvent: vi.fn(),
  },
}));

import { apiClient } from "../../services/api";
import GuestRegistration from "../../pages/GuestRegistration";

describe("GuestRegistration - No Roles Available path", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders 'No Roles Available' when no participant-level roles match", async () => {
    (apiClient.getEvent as any).mockResolvedValue({
      id: "e-none",
      title: "Community Event",
      type: "Hybrid Service",
      roles: [
        { id: "x1", name: "Greeter", description: "" },
        { id: "x2", name: "Usher", description: "" },
        { id: "x3", name: "Photographer", description: "" },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/guest-register/e-none"]}>
        <Routes>
          <Route path="/guest-register/:id" element={<GuestRegistration />} />
        </Routes>
      </MemoryRouter>
    );

    // Expect the empty-state heading and no role select
    expect(
      await screen.findByRole("heading", { name: /No Roles Available/i })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/Available Roles/i)).toBeNull();
  });
});
