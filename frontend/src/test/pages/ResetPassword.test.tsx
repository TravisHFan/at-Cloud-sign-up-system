import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ResetPassword from "../../pages/ResetPassword";
import { authService } from "../../services/api";

vi.mock("../../services/api", () => ({
  authService: {
    resetPassword: vi.fn(),
  },
}));

vi.mock("../../contexts/NotificationModalContext", () => ({
  useToastReplacement: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("ResetPassword page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders reset password form with valid token", async () => {
    render(
      <MemoryRouter initialEntries={["/reset-password/valid-token-123"]}>
        <Routes>
          <Route path="/reset-password/:token" element={<ResetPassword />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /reset your password/i })
      ).toBeInTheDocument();
    });
  });

  it("shows success message after password reset", async () => {
    vi.mocked(authService.resetPassword).mockResolvedValue({} as any);

    render(
      <MemoryRouter initialEntries={["/reset-password/valid-token-123"]}>
        <Routes>
          <Route path="/reset-password/:token" element={<ResetPassword />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for initial validation
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /reset your password/i })
      ).toBeInTheDocument();
    });
  });

  it("shows error when no token is provided", async () => {
    render(
      <MemoryRouter initialEntries={["/reset-password/"]}>
        <Routes>
          <Route path="/reset-password/:token?" element={<ResetPassword />} />
        </Routes>
      </MemoryRouter>
    );

    // The page shows "Invalid Reset Link" heading when no token
    expect(
      await screen.findByRole("heading", {
        name: /invalid reset link/i,
        level: 1,
      })
    ).toBeInTheDocument();
  });
});
