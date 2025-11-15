import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import AuditLogs from "../../pages/AuditLogs";
import { useAuth } from "../../hooks/useAuth";
import { apiFetch } from "../../lib/apiClient";

vi.mock("../../hooks/useAuth");
vi.mock("../../lib/apiClient");

const mockedUseAuth = useAuth as unknown as ReturnType<typeof vi.fn>;
const mockedApiFetch = apiFetch as unknown as ReturnType<typeof vi.fn>;

describe("AuditLogs page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithRouter = () => {
    return render(
      <MemoryRouter>
        <AuditLogs />
      </MemoryRouter>
    );
  };

  describe("Access Control", () => {
    it("shows access restricted for Participant users", () => {
      mockedUseAuth.mockReturnValue({
        currentUser: { role: "Participant" },
      } as any);

      renderWithRouter();

      expect(screen.getByText(/access restricted/i)).toBeInTheDocument();
      expect(
        screen.getByText(/only accessible to Super Administrators/i)
      ).toBeInTheDocument();
    });

    it("shows access restricted for Leader users", () => {
      mockedUseAuth.mockReturnValue({
        currentUser: { role: "Leader" },
      } as any);

      renderWithRouter();

      expect(screen.getByText(/access restricted/i)).toBeInTheDocument();
    });

    it("shows access restricted for Guest Expert users", () => {
      mockedUseAuth.mockReturnValue({
        currentUser: { role: "Guest Expert" },
      } as any);

      renderWithRouter();

      expect(screen.getByText(/access restricted/i)).toBeInTheDocument();
    });

    it("allows Super Admin users to access", async () => {
      mockedUseAuth.mockReturnValue({
        currentUser: { role: "Super Admin" },
      } as any);
      mockedApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { auditLogs: [] } }),
      });

      renderWithRouter();

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /Audit Logs/i, level: 1 })
        ).toBeInTheDocument();
      });
    });

    it("allows Administrator users to access", async () => {
      mockedUseAuth.mockReturnValue({
        currentUser: { role: "Administrator" },
      } as any);
      mockedApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { auditLogs: [] } }),
      });

      renderWithRouter();

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /Audit Logs/i, level: 1 })
        ).toBeInTheDocument();
      });
    });
  });

  describe("Loading State", () => {
    it("shows loading spinner while fetching logs", () => {
      mockedUseAuth.mockReturnValue({
        currentUser: { role: "Administrator" },
      } as any);
      mockedApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { auditLogs: [] } }),
      });

      renderWithRouter();

      const spinner = document.querySelector(
        ".animate-spin.rounded-full.border-4.border-gray-200.border-t-blue-500"
      );
      expect(spinner).not.toBeNull();
    });
  });

  describe("Page Header and UI", () => {
    it("displays audit logs header and description", async () => {
      mockedUseAuth.mockReturnValue({
        currentUser: { role: "Administrator" },
      } as any);
      mockedApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { auditLogs: [] } }),
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText("Audit Logs")).toBeInTheDocument();
        expect(
          screen.getByText(/View and monitor audit logs/i)
        ).toBeInTheDocument();
      });
    });

    it("displays access restriction badge", async () => {
      mockedUseAuth.mockReturnValue({
        currentUser: { role: "Administrator" },
      } as any);
      mockedApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { auditLogs: [] } }),
      });

      renderWithRouter();

      await waitFor(() => {
        expect(
          screen.getByText(
            /Access restricted: only Super Admin and Administrator/i
          )
        ).toBeInTheDocument();
      });
    });

    it("displays retention policy information", async () => {
      mockedUseAuth.mockReturnValue({
        currentUser: { role: "Administrator" },
      } as any);
      mockedApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { auditLogs: [] } }),
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/Data Retention Policy/i)).toBeInTheDocument();
        expect(screen.getByText(/3 months/i)).toBeInTheDocument();
        expect(
          screen.getByText(/Automated cleanup runs hourly/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("Filters", () => {
    it("renders all filter controls", async () => {
      mockedUseAuth.mockReturnValue({
        currentUser: { role: "Administrator" },
      } as any);
      mockedApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { auditLogs: [] } }),
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/Action Type/i)).toBeInTheDocument();
        expect(screen.getByText(/Date/i)).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /Reset Filters/i })
        ).toBeInTheDocument();
      });
    });
  });

  describe("Audit Log Display", () => {
    it("renders logs table when data is loaded", async () => {
      mockedUseAuth.mockReturnValue({
        currentUser: { role: "Administrator" },
      } as any);
      mockedApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            auditLogs: [
              {
                id: "1",
                action: "EventPublished",
                createdAt: new Date().toISOString(),
                actorInfo: {
                  username: "admin",
                  email: "admin@test.com",
                  name: "Admin User",
                  role: "Administrator",
                },
              },
            ],
          },
        }),
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/EventPublished/i)).toBeInTheDocument();
        expect(screen.getByText(/Admin User/i)).toBeInTheDocument();
      });
    });

    it("displays timestamp for each log entry", async () => {
      const testDate = new Date("2024-01-15T10:30:00Z");
      mockedUseAuth.mockReturnValue({
        currentUser: { role: "Administrator" },
      } as any);
      mockedApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            auditLogs: [
              {
                id: "1",
                action: "EventPublished",
                createdAt: testDate.toISOString(),
              },
            ],
          },
        }),
      });

      renderWithRouter();

      await waitFor(() => {
        // Date will be formatted to local time
        const formattedDate = testDate.toLocaleString();
        expect(screen.getByText(formattedDate)).toBeInTheDocument();
      });
    });

    it("displays actor information when available", async () => {
      mockedUseAuth.mockReturnValue({
        currentUser: { role: "Administrator" },
      } as any);
      mockedApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            auditLogs: [
              {
                id: "1",
                action: "EventPublished",
                createdAt: new Date().toISOString(),
                actorInfo: {
                  username: "jdoe",
                  email: "jdoe@test.com",
                  name: "John Doe",
                  role: "Administrator",
                },
              },
            ],
          },
        }),
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
        expect(screen.getByText("Administrator")).toBeInTheDocument();
      });
    });

    it("displays Unknown User when actor info is missing", async () => {
      mockedUseAuth.mockReturnValue({
        currentUser: { role: "Administrator" },
      } as any);
      mockedApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            auditLogs: [
              {
                id: "1",
                action: "EventPublished",
                createdAt: new Date().toISOString(),
                actorInfo: null,
              },
            ],
          },
        }),
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText("Unknown User")).toBeInTheDocument();
      });
    });

    it("displays target model and ID for new format logs", async () => {
      mockedUseAuth.mockReturnValue({
        currentUser: { role: "Administrator" },
      } as any);
      mockedApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            auditLogs: [
              {
                id: "1",
                action: "event_deletion",
                createdAt: new Date().toISOString(),
                targetModel: "Event",
                targetId: "507f1f77bcf86cd799439011",
              },
            ],
          },
        }),
      });

      renderWithRouter();

      await waitFor(() => {
        const eventTexts = screen.getAllByText("Event");
        expect(eventTexts.length).toBeGreaterThan(0);
        expect(screen.getByText("99439011")).toBeInTheDocument(); // Last 8 chars of ID
      });
    });

    it("displays event title for legacy format logs", async () => {
      mockedUseAuth.mockReturnValue({
        currentUser: { role: "Administrator" },
      } as any);
      mockedApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            auditLogs: [
              {
                id: "1",
                action: "EventPublished",
                createdAt: new Date().toISOString(),
                eventTitle: "Test Event",
                eventId: "507f1f77bcf86cd799439011",
              },
            ],
          },
        }),
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText("Test Event")).toBeInTheDocument();
      });
    });

    it("shows N/A when no target information available", async () => {
      mockedUseAuth.mockReturnValue({
        currentUser: { role: "Administrator" },
      } as any);
      mockedApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            auditLogs: [
              {
                id: "1",
                action: "user_deactivation",
                createdAt: new Date().toISOString(),
              },
            ],
          },
        }),
      });

      renderWithRouter();

      await waitFor(() => {
        const naTexts = screen.getAllByText("N/A");
        expect(naTexts.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Action Badge Colors", () => {
    const actionColorTests = [
      { action: "EventPublished", description: "green for EventPublished" },
      { action: "EventUnpublished", description: "red for EventUnpublished" },
      { action: "event_deletion", description: "rose for event_deletion" },
      { action: "event_cancelled", description: "orange for event_cancelled" },
      {
        action: "user_deactivation",
        description: "amber for user_deactivation",
      },
      {
        action: "user_reactivation",
        description: "lime for user_reactivation",
      },
      { action: "user_deletion", description: "red for user_deletion" },
      {
        action: "admin_profile_edit",
        description: "cyan for admin_profile_edit",
      },
      {
        action: "program_deletion",
        description: "purple for program_deletion",
      },
      {
        action: "PublicRegistrationCreated",
        description: "blue for PublicRegistrationCreated",
      },
    ];

    actionColorTests.forEach(({ action, description }) => {
      it(`displays ${description}`, async () => {
        mockedUseAuth.mockReturnValue({
          currentUser: { role: "Administrator" },
        } as any);
        mockedApiFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              auditLogs: [
                {
                  id: "1",
                  action,
                  createdAt: new Date().toISOString(),
                },
              ],
            },
          }),
        });

        renderWithRouter();

        await waitFor(() => {
          expect(screen.getByText(action)).toBeInTheDocument();
        });
      });
    });

    it("displays default gray badge for unknown actions", async () => {
      mockedUseAuth.mockReturnValue({
        currentUser: { role: "Administrator" },
      } as any);
      mockedApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            auditLogs: [
              {
                id: "1",
                action: "unknown_action",
                createdAt: new Date().toISOString(),
              },
            ],
          },
        }),
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText("unknown_action")).toBeInTheDocument();
      });
    });
  });

  describe("Details Display", () => {
    it("shows details section for logs with details", async () => {
      mockedUseAuth.mockReturnValue({
        currentUser: { role: "Administrator" },
      } as any);
      mockedApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            auditLogs: [
              {
                id: "1",
                action: "admin_profile_edit",
                createdAt: new Date().toISOString(),
                details: {
                  targetUser: { email: "user@test.com" },
                  changes: { firstName: "John" },
                },
              },
            ],
          },
        }),
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText("View details")).toBeInTheDocument();
      });
    });

    it("shows metadata section for legacy logs", async () => {
      mockedUseAuth.mockReturnValue({
        currentUser: { role: "Administrator" },
      } as any);
      mockedApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            auditLogs: [
              {
                id: "1",
                action: "EventPublished",
                createdAt: new Date().toISOString(),
                metadata: { eventId: "123", timestamp: "2024-01-15" },
              },
            ],
          },
        }),
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText("View metadata")).toBeInTheDocument();
      });
    });
  });

  describe("Pagination", () => {
    it("displays pagination controls when multiple pages exist", async () => {
      mockedUseAuth.mockReturnValue({
        currentUser: { role: "Administrator" },
      } as any);
      mockedApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            auditLogs: [
              {
                id: "1",
                action: "EventPublished",
                createdAt: new Date().toISOString(),
              },
            ],
            pagination: {
              currentPage: 1,
              totalPages: 3,
              totalCount: 60,
            },
          },
        }),
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/Page 1 of 3/i)).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /Prev/i })
        ).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /Next/i })
        ).toBeInTheDocument();
      });
    });

    it("disables Prev button on first page", async () => {
      mockedUseAuth.mockReturnValue({
        currentUser: { role: "Administrator" },
      } as any);
      mockedApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            auditLogs: [],
            pagination: {
              currentPage: 1,
              totalPages: 2,
              totalCount: 40,
            },
          },
        }),
      });

      renderWithRouter();

      await waitFor(() => {
        const prevButton = screen.getByRole("button", { name: /Prev/i });
        expect(prevButton).toBeDisabled();
      });
    });
    it("navigates to next page when Next is clicked", async () => {
      const user = userEvent.setup();
      mockedUseAuth.mockReturnValue({
        currentUser: { role: "Administrator" },
      } as any);
      mockedApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            auditLogs: [],
            pagination: {
              currentPage: 1,
              totalPages: 3,
              totalCount: 60,
            },
          },
        }),
      });

      renderWithRouter();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Next/i })
        ).toBeInTheDocument();
      });

      const nextButton = screen.getByRole("button", { name: /Next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(mockedApiFetch).toHaveBeenCalledWith(
          expect.stringContaining("page=2")
        );
      });
    });

    it("navigates to previous page when Prev is clicked", async () => {
      const user = userEvent.setup();
      mockedUseAuth.mockReturnValue({
        currentUser: { role: "Administrator" },
      } as any);
      mockedApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            auditLogs: [],
            pagination: {
              currentPage: 2,
              totalPages: 3,
              totalCount: 60,
            },
          },
        }),
      });

      renderWithRouter();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Prev/i })
        ).toBeInTheDocument();
      });

      const prevButton = screen.getByRole("button", { name: /Prev/i });
      await user.click(prevButton);

      await waitFor(() => {
        expect(mockedApiFetch).toHaveBeenCalledWith(
          expect.stringContaining("page=1")
        );
      });
    });

    it("hides pagination when only one page exists", async () => {
      mockedUseAuth.mockReturnValue({
        currentUser: { role: "Administrator" },
      } as any);
      mockedApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            auditLogs: [],
            pagination: {
              currentPage: 1,
              totalPages: 1,
              totalCount: 5,
            },
          },
        }),
      });

      renderWithRouter();

      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: /Prev/i })
        ).not.toBeInTheDocument();
        expect(
          screen.queryByRole("button", { name: /Next/i })
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Empty States", () => {
    it("shows no logs message when no data is available", async () => {
      mockedUseAuth.mockReturnValue({
        currentUser: { role: "Administrator" },
      } as any);
      mockedApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { auditLogs: [] } }),
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/No audit logs found/i)).toBeInTheDocument();
        expect(
          screen.getByText(
            /Audit logs will appear here as actions are performed/i
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe("Count Display", () => {
    it("displays count of current logs and total", async () => {
      mockedUseAuth.mockReturnValue({
        currentUser: { role: "Administrator" },
      } as any);
      mockedApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            auditLogs: [
              {
                id: "1",
                action: "EventPublished",
                createdAt: new Date().toISOString(),
              },
              {
                id: "2",
                action: "EventUnpublished",
                createdAt: new Date().toISOString(),
              },
            ],
            pagination: { currentPage: 1, totalPages: 1, totalCount: 2 },
          },
        }),
      });

      renderWithRouter();

      await waitFor(() => {
        expect(
          screen.getByText(/Showing 2 of 2 audit logs/i)
        ).toBeInTheDocument();
      });
    });

    it("shows 0 when no logs are available", async () => {
      mockedUseAuth.mockReturnValue({
        currentUser: { role: "Administrator" },
      } as any);
      mockedApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { auditLogs: [] } }),
      });

      renderWithRouter();

      await waitFor(() => {
        expect(
          screen.getByText(/Showing 0 of 0 audit logs/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    it("shows error state when fetch fails", async () => {
      mockedUseAuth.mockReturnValue({
        currentUser: { role: "Administrator" },
      } as any);
      mockedApiFetch.mockRejectedValue(new Error("Network error"));

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      });
    });

    it("shows generic error message when API response is not ok", async () => {
      mockedUseAuth.mockReturnValue({
        currentUser: { role: "Administrator" },
      } as any);
      mockedApiFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ success: false, message: "Server error" }),
      });

      renderWithRouter();

      await waitFor(() => {
        expect(
          screen.getByText(/Failed to fetch audit logs/i)
        ).toBeInTheDocument();
      });
    });

    it("shows generic error for invalid response format", async () => {
      mockedUseAuth.mockReturnValue({
        currentUser: { role: "Administrator" },
      } as any);
      mockedApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ invalid: "response" }),
      });

      renderWithRouter();

      await waitFor(() => {
        expect(
          screen.getByText(/Invalid response format/i)
        ).toBeInTheDocument();
      });
    });
  });
});
