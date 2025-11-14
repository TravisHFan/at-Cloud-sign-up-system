import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import EmailVerification from "../../pages/EmailVerification";

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
});
