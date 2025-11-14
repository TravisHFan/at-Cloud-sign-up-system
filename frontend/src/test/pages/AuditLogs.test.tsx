import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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

  it("shows access restricted for non-admin users", () => {
    mockedUseAuth.mockReturnValue({
      currentUser: { role: "Participant" },
    } as any);

    renderWithRouter();

    expect(screen.getByText(/access restricted/i)).toBeInTheDocument();
  });

  it("shows loading state while fetching logs for admin", () => {
    mockedUseAuth.mockReturnValue({
      currentUser: { role: "Administrator" },
    } as any);
    mockedApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { auditLogs: [] } }),
    });

    renderWithRouter();

    expect(screen.getByText(/loading audit logs/i)).toBeInTheDocument();
  });

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
            },
          ],
        },
      }),
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText(/EventPublished/i)).toBeInTheDocument();
    });
  });

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
});
