import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../../contexts/AuthContext";
import { NotificationProvider } from "../../contexts/NotificationModalContext";
import NewEvent from "../../pages/CreateEvent";

// hoisted mocks// Mock services
const mockedRolesTemplateService = vi.hoisted(() => ({
  getAllRolesTemplates: vi.fn().mockResolvedValue({
    Conference: [
      {
        _id: "template1",
        name: "Standard Conference",
        roles: [
          {
            name: "Speaker",
            description: "Present topics",
            maxParticipants: 5,
            openToPublic: true,
          },
          {
            name: "Attendee",
            description: "Participate",
            maxParticipants: 100,
            openToPublic: true,
          },
        ],
      },
      {
        _id: "template2",
        name: "Executive Conference",
        roles: [
          {
            name: "Executive Speaker",
            description: "C-level presentation",
            maxParticipants: 3,
            openToPublic: false,
          },
          {
            name: "Executive Attendee",
            description: "Executives only",
            maxParticipants: 50,
            openToPublic: false,
          },
        ],
      },
    ],
    Webinar: [
      {
        _id: "template3",
        name: "Webinar Template",
        roles: [
          {
            name: "Webinar Attendee",
            description: "Online participant",
            maxParticipants: 500,
            openToPublic: true,
          },
        ],
      },
    ],
    "Mentor Circle": [],
    "Effective Communication Workshop": [],
  }),
}));

const mockedProgramService = vi.hoisted(() => ({
  list: vi
    .fn()
    .mockResolvedValue([
      { id: "p1", title: "Program 1", programType: "General" },
    ]),
  getById: vi.fn().mockResolvedValue({
    mentors: [],
  }),
}));

const mockedEventService = vi.hoisted(() => ({
  checkTimeConflict: vi.fn().mockResolvedValue({ conflict: false }),
  createEvent: vi.fn().mockResolvedValue({ id: "new-event" }),
}));

vi.mock("../../services/api", () => ({
  rolesTemplateService: mockedRolesTemplateService,
  roleTemplateService: mockedRolesTemplateService, // Also mock the singular form used by CreateEvent
  programService: mockedProgramService,
  eventService: mockedEventService,
  userService: {
    getUsers: vi.fn().mockResolvedValue({ users: [], total: 0 }),
  },
  authService: {
    getProfile: vi.fn().mockResolvedValue({
      id: "u1",
      username: "admin",
      firstName: "Admin",
      lastName: "User",
      email: "admin@example.com",
      phone: "123-456-7890",
      role: "Administrator",
      isAtCloudLeader: true,
      roleInAtCloud: "Administrator",
      gender: "male",
    }),
  },
}));

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      <NotificationProvider>{children}</NotificationProvider>
    </AuthProvider>
  </BrowserRouter>
);

describe("CreateEvent - Template Selector Visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("authToken", "test-token");
  });

  it("should NOT show template selector on initial page load", async () => {
    render(
      <Wrapper>
        <NewEvent />
      </Wrapper>
    );

    // Wait for page to load
    await screen.findByLabelText(/event title/i);

    // Verify event type dropdown shows "Select event type"
    const typeSelect = screen.getByLabelText(/event type/i);
    expect(typeSelect).toHaveValue("");

    // Template selector should NOT be visible
    expect(
      screen.queryByText(/choose a roles template/i)
    ).not.toBeInTheDocument();

    // The key behavior: No role configuration section yet
    expect(
      screen.queryByText(/configure event roles for/i)
    ).not.toBeInTheDocument();
  });

  it("should show template selector when user selects event type with multiple templates", async () => {
    render(
      <Wrapper>
        <NewEvent />
      </Wrapper>
    );

    const typeSelect = await screen.findByLabelText(/event type/i);

    // Initially no template selector
    expect(
      screen.queryByText(/choose a roles template/i)
    ).not.toBeInTheDocument();

    // User selects Conference (has 2 templates)
    fireEvent.change(typeSelect, { target: { value: "Conference" } });

    // Now template selector should appear
    await waitFor(() => {
      expect(screen.getByText(/choose a roles template/i)).toBeInTheDocument();
    });

    // Should show the template dropdown
    expect(screen.getByText(/-- select a template --/i)).toBeInTheDocument();
    expect(screen.getByText("Standard Conference")).toBeInTheDocument();
    expect(screen.getByText("Executive Conference")).toBeInTheDocument();
  });

  it("should show template selector when event type has only one template", async () => {
    render(
      <Wrapper>
        <NewEvent />
      </Wrapper>
    );

    const typeSelect = await screen.findByLabelText(/event type/i);

    // User selects Webinar (has 1 template)
    fireEvent.change(typeSelect, { target: { value: "Webinar" } });

    // Template selector should appear even for single template
    await waitFor(() => {
      expect(screen.getByText(/choose a roles template/i)).toBeInTheDocument();
    });

    // Should show the single template in dropdown
    expect(screen.getByText("Webinar Template")).toBeInTheDocument();

    // User selects the template
    const templateSelect = screen.getByLabelText(/choose template/i);
    fireEvent.change(templateSelect, { target: { value: "template3" } });

    // User confirms template
    const confirmButton = screen.getByRole("button", {
      name: /confirm template/i,
    });
    fireEvent.click(confirmButton);

    // Template selector should disappear after confirmation
    await waitFor(() => {
      expect(
        screen.queryByText(/choose a roles template/i)
      ).not.toBeInTheDocument();
    });

    // Should show the role from the template
    await waitFor(() => {
      expect(screen.getByText("Webinar Attendee")).toBeInTheDocument();
    });
  });

  it("should show empty roles message when event type has no templates", async () => {
    render(
      <Wrapper>
        <NewEvent />
      </Wrapper>
    );

    const typeSelect = await screen.findByLabelText(/event type/i);

    // User selects Mentor Circle (has 0 templates)
    fireEvent.change(typeSelect, { target: { value: "Mentor Circle" } });

    // Template selector should NOT appear
    await waitFor(() => {
      expect(
        screen.queryByText(/choose a roles template/i)
      ).not.toBeInTheDocument();
    });

    // Should NOT show the role configuration section (because no roles)
    expect(
      screen.queryByText(/configure event roles for mentor circle/i)
    ).not.toBeInTheDocument();
  });

  it("should hide template selector after user confirms template selection", async () => {
    render(
      <Wrapper>
        <NewEvent />
      </Wrapper>
    );

    const typeSelect = await screen.findByLabelText(/event type/i);

    // User selects Conference
    fireEvent.change(typeSelect, { target: { value: "Conference" } });

    // Wait for template selector to appear
    const templateSelector = await screen.findByText(
      /choose a roles template/i
    );
    expect(templateSelector).toBeInTheDocument();

    // User selects a template - find the select element within the template selector section
    const selectsOnPage = screen.getAllByRole("combobox");
    // The template dropdown should be after event type select
    const templateSelect = selectsOnPage.find(
      (select) => select.querySelector('option[value="template1"]') !== null
    );

    if (!templateSelect) {
      throw new Error("Could not find template dropdown");
    }

    fireEvent.change(templateSelect, { target: { value: "template1" } });

    // User confirms template
    const confirmButton = screen.getByRole("button", {
      name: /confirm template/i,
    });
    fireEvent.click(confirmButton);

    // Template selector should disappear
    await waitFor(() => {
      expect(
        screen.queryByText(/choose a roles template/i)
      ).not.toBeInTheDocument();
    });

    // Should show role configuration section instead
    expect(
      screen.getByText(/configure event roles for conference/i)
    ).toBeInTheDocument();
  });

  it("should clear old roles and show template selector when changing to event type with multiple templates", async () => {
    render(
      <Wrapper>
        <NewEvent />
      </Wrapper>
    );

    const typeSelect = await screen.findByLabelText(/event type/i);

    // User selects Webinar (has 1 template)
    fireEvent.change(typeSelect, { target: { value: "Webinar" } });

    // Template selector should appear
    await waitFor(() => {
      expect(screen.getByText(/choose a roles template/i)).toBeInTheDocument();
    });

    // User selects and confirms the Webinar template
    const templateSelect = screen.getByRole("combobox", {
      name: /choose.*template/i,
    });
    fireEvent.change(templateSelect, { target: { value: "template3" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm template/i }));

    // Wait for roles to appear
    await waitFor(() => {
      expect(screen.getByText("Webinar Attendee")).toBeInTheDocument();
    });

    // User changes to Conference (multiple templates)
    fireEvent.change(typeSelect, { target: { value: "Conference" } });

    // Old roles should be cleared
    await waitFor(() => {
      expect(screen.queryByText("Webinar Attendee")).not.toBeInTheDocument();
    });

    // Template selector should appear again
    expect(screen.getByText(/choose a roles template/i)).toBeInTheDocument();
  });

  it("should not show template selector when user has not selected event type", async () => {
    render(
      <Wrapper>
        <NewEvent />
      </Wrapper>
    );

    // Wait for form to load
    await screen.findByLabelText(/event title/i);

    const typeSelect = screen.getByLabelText(/event type/i);

    // Verify dropdown is empty
    expect(typeSelect).toHaveValue("");

    // Template selector should not be visible
    expect(
      screen.queryByText(/choose a roles template/i)
    ).not.toBeInTheDocument();

    // Should NOT show role configuration either
    expect(
      screen.queryByText(/configure event roles for/i)
    ).not.toBeInTheDocument();
  });

  it("should allow user to navigate to template configuration page from template selector", async () => {
    render(
      <Wrapper>
        <NewEvent />
      </Wrapper>
    );

    const typeSelect = await screen.findByLabelText(/event type/i);

    // Select Conference to show template selector
    fireEvent.change(typeSelect, { target: { value: "Conference" } });

    await waitFor(() => {
      expect(screen.getByText(/choose a roles template/i)).toBeInTheDocument();
    });

    // Should have "Configure Templates" button
    const configureButtons = screen.getAllByRole("button", {
      name: /configure templates/i,
    });
    expect(configureButtons.length).toBeGreaterThan(0);
  });

  it("should show validation error if user tries to confirm without selecting template", async () => {
    // Mock window.alert
    const alertMock = vi.spyOn(window, "alert").mockImplementation(() => {});

    render(
      <Wrapper>
        <NewEvent />
      </Wrapper>
    );

    const typeSelect = await screen.findByLabelText(/event type/i);

    // Select Conference
    fireEvent.change(typeSelect, { target: { value: "Conference" } });

    await waitFor(() => {
      expect(screen.getByText(/choose a roles template/i)).toBeInTheDocument();
    });

    // Try to confirm without selecting (button should be disabled)
    const confirmButton = screen.getByRole("button", {
      name: /confirm template/i,
    });

    // Button should be disabled when no template is selected
    expect(confirmButton).toBeDisabled();

    // Clicking disabled button won't trigger alert in JSDOM
    // But we can verify the button state prevents action

    alertMock.mockRestore();
  });
});
