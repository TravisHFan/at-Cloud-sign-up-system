import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLogin } from "../../hooks/useLogin";

const mocks = vi.hoisted(() => ({
  resendVerification: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("../../services/api", () => ({
  authService: {
    resendVerification: mocks.resendVerification,
  },
}));

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ login: vi.fn() }),
}));

vi.mock("../../contexts/NotificationModalContext", () => ({
  useToastReplacement: () => ({
    success: mocks.success,
    error: mocks.error,
    warning: mocks.warning,
  }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

describe("useLogin verification resend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the backend auth API instead of generating a token in the browser", async () => {
    mocks.resendVerification.mockResolvedValue(undefined);
    const { result } = renderHook(() => useLogin(), { wrapper });
    const email = "resend-success@example.com";

    await act(async () => {
      await result.current.handleResendVerification(email);
    });

    expect(mocks.resendVerification).toHaveBeenCalledWith(email);
    expect(mocks.success).toHaveBeenCalledWith(
      "Verification email sent! Please check your inbox and spam folder.",
      expect.objectContaining({ title: "Email Sent" }),
    );
  });

  it("reports backend resend failures", async () => {
    mocks.resendVerification.mockRejectedValue(new Error("send failed"));
    const { result } = renderHook(() => useLogin(), { wrapper });

    await act(async () => {
      await result.current.handleResendVerification(
        "resend-failure@example.com",
      );
    });

    expect(mocks.error).toHaveBeenCalledWith(
      "Failed to resend verification email. Please try again.",
      expect.objectContaining({ title: "Send Failed" }),
    );
  });
});
