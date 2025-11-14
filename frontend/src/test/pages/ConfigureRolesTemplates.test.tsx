import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import ConfigureRolesTemplates from "../../pages/ConfigureRolesTemplates";

vi.mock("../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../services/api")>(
    "../../services/api"
  );
  return {
    ...actual,
    roleTemplateService: {
      ...actual.roleTemplateService,
      getAllRolesTemplates: vi.fn(),
      deleteRolesTemplate: vi.fn(),
    },
  };
});

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    currentUser: {
      id: "user-1",
      role: "Administrator",
    },
  }),
}));

import { roleTemplateService } from "../../services/api";

const groupedTemplates = {
  Conference: [
    {
      _id: "t1",
      name: "Conference Template 1",
      eventType: "Conference",
      roles: [
        { name: "Host", maxParticipants: 2 },
        { name: "Greeter", maxParticipants: 5 },
      ],
      createdBy: {
        _id: "user-1",
        username: "admin",
        firstName: "Admin",
      },
      createdAt: new Date("2025-01-01").toISOString(),
      updatedAt: new Date("2025-01-02").toISOString(),
    },
  ],
  Webinar: [],
};

describe("ConfigureRolesTemplates page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <ConfigureRolesTemplates />
      </MemoryRouter>
    );

  it("shows loading state initially", async () => {
    vi.mocked(roleTemplateService.getAllRolesTemplates).mockImplementation(
      () => new Promise(() => {})
    );

    renderPage();

    // LoadingSpinner now renders only a visual spinner without text,
    // so we assert that the centered fullscreen container is present
    // by matching its layout classes rather than the old loading text.
    const container = document.querySelector(
      ".min-h-screen.bg-gray-50.flex.items-center.justify-center"
    );
    expect(container).not.toBeNull();
  });

  it("renders templates grouped by event type when loaded", async () => {
    vi.mocked(roleTemplateService.getAllRolesTemplates).mockResolvedValue(
      groupedTemplates as any
    );

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText("Configure Event Roles Templates")
      ).toBeInTheDocument();
      expect(screen.getByText("Conference")).toBeInTheDocument();
      expect(screen.getByText("Conference Template 1")).toBeInTheDocument();
      expect(screen.getByText("2 roles")).toBeInTheDocument();
    });

    // Empty state for Webinar specifically (text lives in a sibling section)
    expect(
      screen.getAllByText(/No templates yet for this event type./i).length
    ).toBeGreaterThan(0);
  });

  it("displays error state when loading fails", async () => {
    vi.mocked(roleTemplateService.getAllRolesTemplates).mockRejectedValue(
      new Error("Network error")
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
  });

  it("opens and confirms delete modal for a template", async () => {
    vi.mocked(roleTemplateService.getAllRolesTemplates).mockResolvedValue(
      groupedTemplates as any
    );
    vi.mocked(roleTemplateService.deleteRolesTemplate).mockResolvedValue(
      undefined as any
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Conference Template 1")).toBeInTheDocument();
    });

    // Click Delete button for the specific template card
    const deleteButtons = screen.getAllByRole("button", { name: /Delete/i });
    expect(deleteButtons.length).toBeGreaterThan(0);
    fireEvent.click(deleteButtons[0]);

    // Confirmation modal should appear
    expect(screen.getByText(/Confirm Deletion/i)).toBeInTheDocument();

    // Confirm deletion in the modal (the red delete button)
    const modal = screen.getByText(/Confirm Deletion/i).closest("div");
    expect(modal).not.toBeNull();
    if (modal) {
      const confirmButton = within(modal).getByRole("button", {
        name: /^Delete$/i,
      });
      fireEvent.click(confirmButton);
    }

    await waitFor(() => {
      expect(roleTemplateService.deleteRolesTemplate).toHaveBeenCalledWith(
        "t1"
      );
      // Success message modal
      expect(
        screen.getByText(/has been deleted successfully/i)
      ).toBeInTheDocument();
    });
  });
});
