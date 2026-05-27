import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import EmailVerification from "../../pages/EmailVerification";
import { API_BASE_URL } from "../../services/api";

const mockNavigate = vi.fn();
const mockNotification = {
  success: vi.fn(),
  error: vi.fn(),
};

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../contexts/NotificationModalContext", () => ({
  useToastReplacement: () => mockNotification,
}));

// Mock fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

describe("EmailVerification page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows verifying state initially", () => {
    mockFetch.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(
      <MemoryRouter initialEntries={["/verify-email/token123"]}>
        <Routes>
          <Route path="/verify-email/:token" element={<EmailVerification />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/verifying your email/i)).toBeInTheDocument();
    expect(
      screen.getByText(/please wait while we verify/i)
    ).toBeInTheDocument();
  });

  it("renders @Cloud logo and header", () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));

    render(
      <MemoryRouter initialEntries={["/verify-email/token123"]}>
        <Routes>
          <Route path="/verify-email/:token" element={<EmailVerification />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByAltText("@Cloud")).toBeInTheDocument();
    expect(screen.getByText(/email verification/i)).toBeInTheDocument();
  });

  it("renders page structure and components", () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));

    render(
      <MemoryRouter initialEntries={["/verify-email/token123"]}>
        <Routes>
          <Route path="/verify-email/:token" element={<EmailVerification />} />
        </Routes>
      </MemoryRouter>
    );

    // Check footer help text exists
    expect(screen.getByText(/need help\?/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /contact support/i })
    ).toBeInTheDocument();
  });

  it("calls the normalized API base URL when verifying", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, alreadyVerified: true }),
    });

    render(
      <MemoryRouter initialEntries={["/verify-email/token123"]}>
        <Routes>
          <Route path="/verify-email/:token" element={<EmailVerification />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/auth/verify-email/token123`,
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  it("accepts a token override for root query verification links", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, alreadyVerified: true }),
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="/"
            element={<EmailVerification tokenOverride="query-token" />}
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/auth/verify-email/query-token`,
        expect.objectContaining({ method: "GET" })
      );
    });
  });
});
