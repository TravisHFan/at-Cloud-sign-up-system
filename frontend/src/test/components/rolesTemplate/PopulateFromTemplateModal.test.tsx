import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import PopulateFromTemplateModal from "../../../../src/components/rolesTemplate/PopulateFromTemplateModal";
import type { RolesTemplate } from "../../../../src/types/rolesTemplate";

// Mock API services using factory function to avoid hoisting issues
vi.mock("../../../../src/services/api", async () => {
  const { createMockApiServices } = await import("../../helpers/mockServices");
  return createMockApiServices();
});

// Import after mocking to get the mocked version
import { roleTemplateService } from "../../../../src/services/api";

const mockTemplates: RolesTemplate[] = [
  {
    _id: "template1",
    name: "Standard Conference Template",
    eventType: "Conference",
    roles: [
      {
        name: "Registration Desk",
        description: "Check-in attendees",
        maxParticipants: 3,
        startTime: "08:00",
        endTime: "09:00",
        openToPublic: true,
      },
      {
        name: "Speaker Support",
        description: "Assist speakers with tech",
        maxParticipants: 2,
        startTime: "09:00",
        endTime: "17:00",
        openToPublic: true,
      },
    ],
    createdBy: {
      _id: "user1",
      username: "admin1",
      firstName: "Admin",
      lastName: "User",
    },
    createdAt: new Date("2025-01-15").toISOString(),
    updatedAt: new Date("2025-01-15").toISOString(),
  },
  {
    _id: "template2",
    name: "Small Conference Template",
    eventType: "Conference",
    roles: [
      {
        name: "Greeter",
        description: "Welcome attendees",
        maxParticipants: 2,
        startTime: "08:30",
        endTime: "09:30",
        openToPublic: true,
      },
    ],
    createdBy: {
      _id: "user2",
      username: "organizer1",
      firstName: "Organizer",
    },
    createdAt: new Date("2025-02-10").toISOString(),
    updatedAt: new Date("2025-02-10").toISOString(),
  },
  {
    _id: "template3",
    name: "Workshop Template",
    eventType: "Workshop",
    roles: [
      {
        name: "Facilitator",
        description: "Lead the workshop",
        maxParticipants: 1,
        openToPublic: true,
      },
    ],
    createdBy: {
      _id: "user3",
      username: "facilitator1",
    },
    createdAt: new Date("2025-03-01").toISOString(),
    updatedAt: new Date("2025-03-01").toISOString(),
  },
];

describe("PopulateFromTemplateModal", () => {
  const mockOnClose = vi.fn();
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    render(
      <PopulateFromTemplateModal
        isOpen={false}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );
    expect(screen.queryByText("Populate from Existing Template")).toBeNull();
  });

  it("renders modal when isOpen is true", async () => {
    vi.mocked(
      roleTemplateService.getRolesTemplatesByEventType
    ).mockResolvedValue(
      mockTemplates.filter((t) => t.eventType === "Conference")
    );

    render(
      <PopulateFromTemplateModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );

    expect(
      screen.getByText("Populate from Existing Template")
    ).toBeInTheDocument();
  });

  it("loads and displays templates on mount", async () => {
    const conferenceTemplates = mockTemplates.filter(
      (t) => t.eventType === "Conference"
    );
    vi.mocked(
      roleTemplateService.getRolesTemplatesByEventType
    ).mockResolvedValue(conferenceTemplates);

    render(
      <PopulateFromTemplateModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText("Standard Conference Template")
      ).toBeInTheDocument();
      expect(screen.getByText("Small Conference Template")).toBeInTheDocument();
    });

    // Should show role counts
    expect(screen.getByText("2 roles")).toBeInTheDocument();
    expect(screen.getByText("1 role")).toBeInTheDocument();
  });

  it("filters templates by eventType", async () => {
    vi.mocked(
      roleTemplateService.getRolesTemplatesByEventType
    ).mockResolvedValue(
      mockTemplates.filter((t) => t.eventType === "Conference")
    );

    render(
      <PopulateFromTemplateModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );

    await waitFor(() => {
      expect(
        roleTemplateService.getRolesTemplatesByEventType
      ).toHaveBeenCalledWith("Conference");
    });

    // Should not show Workshop template
    expect(screen.queryByText("Workshop Template")).toBeNull();
  });

  it("handles search functionality", async () => {
    const conferenceTemplates = mockTemplates.filter(
      (t) => t.eventType === "Conference"
    );
    vi.mocked(
      roleTemplateService.getRolesTemplatesByEventType
    ).mockResolvedValue(conferenceTemplates);

    render(
      <PopulateFromTemplateModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText("Standard Conference Template")
      ).toBeInTheDocument();
    });

    // Search for "Small"
    const searchInput = screen.getByPlaceholderText(
      "Search templates by name..."
    );
    fireEvent.change(searchInput, { target: { value: "Small" } });

    await waitFor(() => {
      expect(screen.getByText("Small Conference Template")).toBeInTheDocument();
      expect(screen.queryByText("Standard Conference Template")).toBeNull();
    });
  });

  it("displays empty state when no templates found", async () => {
    vi.mocked(
      roleTemplateService.getRolesTemplatesByEventType
    ).mockResolvedValue([]);

    render(
      <PopulateFromTemplateModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText("No Conference templates found")
      ).toBeInTheDocument();
    });
  });

  it("displays error state when loading fails", async () => {
    vi.mocked(
      roleTemplateService.getRolesTemplatesByEventType
    ).mockRejectedValue(new Error("Network error"));

    render(
      <PopulateFromTemplateModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("calls onSelect with template data when template is clicked", async () => {
    const conferenceTemplates = mockTemplates.filter(
      (t) => t.eventType === "Conference"
    );
    vi.mocked(
      roleTemplateService.getRolesTemplatesByEventType
    ).mockResolvedValue(conferenceTemplates);

    render(
      <PopulateFromTemplateModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText("Standard Conference Template")
      ).toBeInTheDocument();
    });

    const templateButton = screen
      .getByText("Standard Conference Template")
      .closest("button");
    fireEvent.click(templateButton!);

    expect(mockOnSelect).toHaveBeenCalledWith(conferenceTemplates[0]);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("calls onClose when Cancel button is clicked", async () => {
    vi.mocked(
      roleTemplateService.getRolesTemplatesByEventType
    ).mockResolvedValue([]);

    render(
      <PopulateFromTemplateModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Cancel"));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("calls onClose when close button (X) is clicked", async () => {
    vi.mocked(
      roleTemplateService.getRolesTemplatesByEventType
    ).mockResolvedValue([]);

    render(
      <PopulateFromTemplateModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText("Populate from Existing Template")
      ).toBeInTheDocument();
    });

    // Find and click the close button (X icon)
    const closeButtons = screen.getAllByRole("button");
    const closeButton = closeButtons.find((btn) => btn.querySelector("svg"));
    if (closeButton) {
      fireEvent.click(closeButton);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it("handles pagination correctly", async () => {
    // Create more than 10 templates to trigger pagination
    const manyTemplates: RolesTemplate[] = Array.from(
      { length: 15 },
      (_, i) => ({
        ...mockTemplates[0],
        _id: `template${i}`,
        name: `Template ${i + 1}`,
      })
    );

    vi.mocked(
      roleTemplateService.getRolesTemplatesByEventType
    ).mockResolvedValue(manyTemplates);

    render(
      <PopulateFromTemplateModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Template 1")).toBeInTheDocument();
    });

    // Should show first 10 templates
    expect(screen.getByText("Template 1")).toBeInTheDocument();
    expect(screen.getByText("Template 10")).toBeInTheDocument();
    expect(screen.queryByText("Template 11")).toBeNull();

    // Should show pagination info
    expect(screen.getByText(/Page 1 of 2/i)).toBeInTheDocument();

    // Click next page
    const nextButton = screen.getByText("Next");
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText("Template 11")).toBeInTheDocument();
    });

    // Should show remaining templates
    expect(screen.getByText("Template 15")).toBeInTheDocument();
    expect(screen.queryByText("Template 1")).toBeNull();
  });

  it("displays loading state while fetching templates", async () => {
    vi.mocked(
      roleTemplateService.getRolesTemplatesByEventType
    ).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
    );

    render(
      <PopulateFromTemplateModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );

    expect(screen.getByText(/Loading/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).toBeNull();
    });
  });

  it("reloads templates when modal is reopened", async () => {
    const conferenceTemplates = mockTemplates.filter(
      (t) => t.eventType === "Conference"
    );
    vi.mocked(
      roleTemplateService.getRolesTemplatesByEventType
    ).mockResolvedValue(conferenceTemplates);

    const { rerender } = render(
      <PopulateFromTemplateModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );

    await waitFor(() => {
      expect(
        roleTemplateService.getRolesTemplatesByEventType
      ).toHaveBeenCalledTimes(1);
    });

    // Close modal
    rerender(
      <PopulateFromTemplateModal
        isOpen={false}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );

    // Reopen modal
    rerender(
      <PopulateFromTemplateModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );

    await waitFor(() => {
      expect(
        roleTemplateService.getRolesTemplatesByEventType
      ).toHaveBeenCalledTimes(2);
    });
  });

  it("displays template information with proper formatting", async () => {
    const conferenceTemplates = [mockTemplates[0]];
    vi.mocked(
      roleTemplateService.getRolesTemplatesByEventType
    ).mockResolvedValue(conferenceTemplates);

    render(
      <PopulateFromTemplateModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText("Standard Conference Template")
      ).toBeInTheDocument();
    });

    // Check that user icon and clock icon are present
    const icons = document.querySelectorAll("svg");
    expect(icons.length).toBeGreaterThan(0);

    // Check role count display
    expect(screen.getByText("2 roles")).toBeInTheDocument();

    // Check creator display
    expect(screen.getByText(/By Admin/i)).toBeInTheDocument();

    // Check created date display
    expect(screen.getByText(/Created/i)).toBeInTheDocument();
  });

  it("displays username when firstName is not available", async () => {
    const templateWithoutFirstName: RolesTemplate = {
      ...mockTemplates[1],
      createdBy: {
        _id: "user2",
        username: "organizer1",
      },
    };

    vi.mocked(
      roleTemplateService.getRolesTemplatesByEventType
    ).mockResolvedValue([templateWithoutFirstName]);

    render(
      <PopulateFromTemplateModal
        isOpen={true}
        onClose={mockOnClose}
        onSelect={mockOnSelect}
        eventType="Conference"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Small Conference Template")).toBeInTheDocument();
    });

    // Should show username instead of firstName
    expect(screen.getByText(/By organizer1/i)).toBeInTheDocument();
  });
});
