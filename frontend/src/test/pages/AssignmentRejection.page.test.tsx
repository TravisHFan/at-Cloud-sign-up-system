import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../services/api", async () => {
  return {
    __esModule: true,
    assignmentService: {
      validateRejection: vi.fn(async (token: string) => {
        if (token === "expired")
          return { success: false, message: "Gone" } as any;
        if (token === "bad")
          throw Object.assign(new Error("Invalid"), { status: 410 });
        return {
          success: true,
          event: {
            id: "e1",
            title: "Sample Event",
            date: "2025-08-09",
            time: "10:00",
            roleName: "Speaker",
          },
          role: "Speaker",
        } as any;
      }),
      submitRejection: vi.fn(async (_token: string, note: string) => {
        if (!note?.trim())
          throw Object.assign(new Error("NOTE_REQUIRED"), { status: 400 });
        if (_token === "expired")
          throw Object.assign(new Error("Gone"), { status: 410 });
        return { success: true, status: "rejected" } as any;
      }),
    },
  };
});

import AssignmentRejection from "../../pages/AssignmentRejection";

describe("AssignmentRejection page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderAt = (initial: string) =>
    render(
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/assignments/reject" element={<AssignmentRejection />} />
        </Routes>
      </MemoryRouter>
    );

  it("renders event details after validate and submits note (happy path)", async () => {
    const user = userEvent.setup();
    renderAt("/assignments/reject?token=good");

    expect(screen.getByText(/Validating/i)).toBeInTheDocument();

    await waitFor(() => screen.getByText(/Decline Role Invitation/i));
    expect(screen.getByText(/Sample Event/)).toBeInTheDocument();

    const textarea = screen.getByRole("textbox", { name: /briefly why/i });
    await user.type(textarea, "I can't attend");
    const btn = screen.getByRole("button", { name: /Decline Invitation/i });
    expect(btn).not.toBeDisabled();
    await user.click(btn);

    await waitFor(() => screen.getByText(/Invitation Declined/i));

    const api = await import("../../services/api");
    expect((api as any).assignmentService.submitRejection).toHaveBeenCalledWith(
      "good",
      "I can't attend"
    );
  });

  it("shows error for invalid/expired token", async () => {
    renderAt("/assignments/reject?token=expired");
    await waitFor(() => screen.getByText(/Link Problem/i));
    expect(screen.getByRole("alert")).toHaveTextContent(
      /invalid or has expired/i
    );
  });

  it("disables submit until note is entered and shows message when missing", async () => {
    const user = userEvent.setup();
    renderAt("/assignments/reject?token=good");
    await waitFor(() => screen.getByText(/Decline Role Invitation/i));

    const btn = screen.getByRole("button", { name: /Decline Invitation/i });
    expect(btn).toBeDisabled();

    await user.click(btn);
    // Still disabled; type whitespace then submit -> api will throw NOTE_REQUIRED
    const textarea = screen.getByRole("textbox", { name: /briefly why/i });
    await user.type(textarea, "   ");
    expect(btn).toBeDisabled();

    await user.clear(textarea);
    await user.type(textarea, "reason");
    expect(btn).not.toBeDisabled();
  });
});
