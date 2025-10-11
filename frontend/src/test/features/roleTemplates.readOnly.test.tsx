/**
 * Role Templates Read-Only Mode Tests
 *
 * Tests the role template read-only feature for leaders:
 * - Leaders can view templates created by others in read-only mode
 * - ConfigureRolesTemplates shows appropriate buttons based on ownership
 * - ViewRolesTemplate page displays template in read-only mode
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ConfigureRolesTemplates from "../../pages/ConfigureRolesTemplates";
import ViewRolesTemplate from "../../pages/ViewRolesTemplate";
import { AuthProvider } from "../../contexts/AuthContext";
import { NotificationProvider } from "../../contexts/NotificationModalContext";
import type { RolesTemplate } from "../../types/rolesTemplate";

// Mock data
const mockLeaderUser = {
  id: "leader-123",
  username: "leader",
  firstName: "Leader",
  lastName: "User",
  email: "leader@example.com",
  role: "Leader",
  isAtCloudLeader: true,
  gender: "male" as const,
};

const mockSuperAdminUser = {
  id: "superadmin-123",
  username: "superadmin",
  firstName: "Super",
  lastName: "Admin",
  email: "superadmin@example.com",
  role: "Super Admin",
  isAtCloudLeader: false,
  gender: "male" as const,
};

const mockLeaderTemplate: RolesTemplate = {
  _id: "template-leader-1",
  name: "Leader's Template",
  eventType: "Conference",
  roles: [
    {
      name: "Host",
      description: "Event host role",
      maxParticipants: 1,
      openToPublic: false,
    },
  ],
  createdBy: {
    _id: "leader-123",
    username: "leader",
    firstName: "Leader",
    lastName: "User",
  },
  createdAt: new Date("2025-01-01").toISOString(),
  updatedAt: new Date("2025-01-01").toISOString(),
};

const mockSuperAdminTemplate: RolesTemplate = {
  _id: "template-admin-1",
  name: "Super Admin's Template",
  eventType: "Webinar",
  roles: [
    {
      name: "Presenter",
      description: "Webinar presenter role",
      maxParticipants: 2,
      openToPublic: true,
    },
  ],
  createdBy: {
    _id: "superadmin-123",
    username: "superadmin",
    firstName: "Super",
    lastName: "Admin",
  },
  createdAt: new Date("2025-01-02").toISOString(),
  updatedAt: new Date("2025-01-02").toISOString(),
};

// Mock API service
const mockGetAllTemplates = vi.fn();
const mockGetTemplateById = vi.fn();
const mockDeleteTemplate = vi.fn();

vi.mock("../../services/api", () => ({
  authService: {
    getProfile: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  },
  rolesTemplateService: {
    getAllTemplates: () => mockGetAllTemplates(),
    getTemplateById: (id: string) => mockGetTemplateById(id),
    deleteTemplate: (id: string) => mockDeleteTemplate(id),
  },
}));

describe("ConfigureRolesTemplates - Button Logic Based on Ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("authToken", "test-token");
  });

  it("shows Edit and Delete buttons for templates created by the leader", async () => {
    // Mock authService to return leader user
    const { authService } = await import("../../services/api");
    vi.mocked(authService.getProfile).mockResolvedValue(mockLeaderUser);

    // Mock template data with leader's template
    mockGetAllTemplates.mockResolvedValue({
      Conference: [mockLeaderTemplate],
      Webinar: [],
      "Effective Communication Workshop": [],
      "Mentor Circle": [],
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/configure-roles-templates"]}>
        <NotificationProvider>
          <AuthProvider>
            <ConfigureRolesTemplates />
          </AuthProvider>
        </NotificationProvider>
      </MemoryRouter>
    );

    // Wait for templates to load
    await waitFor(() => {
      expect(screen.getByText("Leader's Template")).toBeTruthy();
    });

    // Should show Edit and Delete buttons
    const editButton = screen.getByRole("button", { name: /^edit$/i });
    const deleteButton = screen.getByRole("button", {
      name: /^delete$/i,
    });

    expect(editButton).toBeTruthy();
    expect(deleteButton).toBeTruthy();
    expect(editButton.className).not.toContain("cursor-not-allowed");
    expect(deleteButton.className).not.toContain("cursor-not-allowed");
  });

  it("shows View Detail button for templates created by others", async () => {
    // Mock authService to return leader user
    const { authService } = await import("../../services/api");
    vi.mocked(authService.getProfile).mockResolvedValue(mockLeaderUser);

    // Mock template data with super admin's template
    mockGetAllTemplates.mockResolvedValue({
      Conference: [],
      Webinar: [mockSuperAdminTemplate],
      "Effective Communication Workshop": [],
      "Mentor Circle": [],
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/configure-roles-templates"]}>
        <NotificationProvider>
          <AuthProvider>
            <ConfigureRolesTemplates />
          </AuthProvider>
        </NotificationProvider>
      </MemoryRouter>
    );

    // Wait for templates to load
    await waitFor(() => {
      expect(screen.getByText("Super Admin's Template")).toBeTruthy();
    });

    // Should show View Detail button instead of Edit/Delete
    const viewDetailButton = screen.getByRole("button", {
      name: /^view detail$/i,
    });

    expect(viewDetailButton).toBeTruthy();
    expect(viewDetailButton.className).toContain("bg-green-100");
    expect(viewDetailButton.className).toContain("text-green-700");

    // Should NOT show Edit or Delete buttons
    expect(screen.queryByRole("button", { name: /^edit$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^delete$/i })).toBeNull();
  });

  it("shows Edit and Delete buttons for all templates when user is Super Admin", async () => {
    // Mock authService to return super admin user
    const { authService } = await import("../../services/api");
    vi.mocked(authService.getProfile).mockResolvedValue(mockSuperAdminUser);

    // Mock template data with leader's template (created by someone else)
    mockGetAllTemplates.mockResolvedValue({
      Conference: [mockLeaderTemplate],
      Webinar: [],
      "Effective Communication Workshop": [],
      "Mentor Circle": [],
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/configure-roles-templates"]}>
        <NotificationProvider>
          <AuthProvider>
            <ConfigureRolesTemplates />
          </AuthProvider>
        </NotificationProvider>
      </MemoryRouter>
    );

    // Wait for templates to load
    await waitFor(() => {
      expect(screen.getByText("Leader's Template")).toBeTruthy();
    });

    // Super Admin should see Edit and Delete buttons even for others' templates
    const editButton = screen.getByRole("button", { name: /^edit$/i });
    const deleteButton = screen.getByRole("button", {
      name: /^delete$/i,
    });

    expect(editButton).toBeTruthy();
    expect(deleteButton).toBeTruthy();
    expect(screen.queryByRole("button", { name: /view detail/i })).toBeNull();
  });
});

describe("ViewRolesTemplate - Read-Only Display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("authToken", "test-token");
  });

  it("displays template in read-only mode with proper UI indicators", async () => {
    // Mock authService to return leader user
    const { authService } = await import("../../services/api");
    vi.mocked(authService.getProfile).mockResolvedValue(mockLeaderUser);

    // Mock getting template by ID
    mockGetTemplateById.mockResolvedValue(mockSuperAdminTemplate);

    render(
      <MemoryRouter
        initialEntries={["/dashboard/view-roles-template/template-admin-1"]}
      >
        <NotificationProvider>
          <AuthProvider>
            <Routes>
              <Route
                path="/dashboard/view-roles-template/:id"
                element={<ViewRolesTemplate />}
              />
            </Routes>
          </AuthProvider>
        </NotificationProvider>
      </MemoryRouter>
    );

    // Wait for template to load
    await waitFor(() => {
      expect(
        screen.getByText(/View Roles Template \(Read-Only\)/i)
      ).toBeTruthy();
    });

    // Check for read-only notice
    expect(screen.getByText(/Read-Only Mode/i)).toBeTruthy();
    expect(
      screen.getByText(/This template was created by another user/i)
    ).toBeTruthy();

    // Check template details are displayed
    expect(screen.getByDisplayValue("Super Admin's Template")).toBeTruthy();
    expect(screen.getByDisplayValue("Webinar")).toBeTruthy();

    // Check creator info is displayed
    expect(screen.getByText(/Created by:/i)).toBeTruthy();
    expect(screen.getByText(/Super Admin/i)).toBeTruthy();

    // Check role is displayed
    const presenterTexts = screen.getAllByText(/Presenter/i);
    expect(presenterTexts.length).toBeGreaterThan(0);
    expect(screen.getByText(/Webinar presenter role/i)).toBeTruthy();

    // Should have "Back to Templates" button instead of "Save"
    const backButtons = screen.getAllByRole("button", {
      name: /back to templates/i,
    });
    expect(backButtons.length).toBeGreaterThan(0);

    // Should NOT have Save or Cancel buttons
    expect(screen.queryByRole("button", { name: /save/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /cancel/i })).toBeNull();
  });

  it("displays all template fields as read-only inputs", async () => {
    // Mock authService
    const { authService } = await import("../../services/api");
    vi.mocked(authService.getProfile).mockResolvedValue(mockLeaderUser);

    // Mock getting template
    mockGetTemplateById.mockResolvedValue(mockSuperAdminTemplate);

    render(
      <MemoryRouter
        initialEntries={["/dashboard/view-roles-template/template-admin-1"]}
      >
        <NotificationProvider>
          <AuthProvider>
            <Routes>
              <Route
                path="/dashboard/view-roles-template/:id"
                element={<ViewRolesTemplate />}
              />
            </Routes>
          </AuthProvider>
        </NotificationProvider>
      </MemoryRouter>
    );

    // Wait for template to load
    await waitFor(() => {
      expect(screen.getByText(/View Roles Template/i)).toBeTruthy();
    });

    // Find the template name input - should be disabled
    const nameInput = screen.getByDisplayValue(
      "Super Admin's Template"
    ) as HTMLInputElement;
    expect(nameInput.disabled).toBe(true);
    expect(nameInput.readOnly).toBe(true);

    // Find the event type input - should be disabled
    const eventTypeInput = screen.getByDisplayValue(
      "Webinar"
    ) as HTMLInputElement;
    expect(eventTypeInput.disabled).toBe(true);
    expect(eventTypeInput.readOnly).toBe(true);
  });

  it("shows error message if template not found", async () => {
    // Mock authService
    const { authService } = await import("../../services/api");
    vi.mocked(authService.getProfile).mockResolvedValue(mockLeaderUser);

    // Mock template not found
    mockGetTemplateById.mockRejectedValue(new Error("Template not found"));

    render(
      <MemoryRouter
        initialEntries={["/dashboard/view-roles-template/nonexistent-id"]}
      >
        <NotificationProvider>
          <AuthProvider>
            <Routes>
              <Route
                path="/dashboard/view-roles-template/:id"
                element={<ViewRolesTemplate />}
              />
            </Routes>
          </AuthProvider>
        </NotificationProvider>
      </MemoryRouter>
    );

    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/Template not found/i)).toBeTruthy();
    });

    // Should have back button
    expect(screen.getByText(/Back to Templates/i)).toBeTruthy();
  });
});
