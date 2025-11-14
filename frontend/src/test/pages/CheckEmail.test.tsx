import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import CheckEmail from "../../pages/CheckEmail";

const mockSuccess = vi.fn();
const mockError = vi.fn();

vi.mock("../../contexts/NotificationModalContext", () => ({
  useToastReplacement: () => ({
    success: mockSuccess,
    error: mockError,
  }),
}));

// Mock fetch globally
globalThis.fetch = vi.fn() as typeof fetch;

describe("CheckEmail page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockClear();
  });

  it("renders the page with title and instructions", () => {
    render(
      <MemoryRouter>
        <CheckEmail />
      </MemoryRouter>
    );

    expect(screen.getByText("Check Your Email")).toBeInTheDocument();
    expect(screen.getByText("Registration Successful!")).toBeInTheDocument();
    expect(screen.getByText("Before you can log in")).toBeInTheDocument();
    expect(
      screen.getByText(
        /please check your email and click the verification link/i
      )
    ).toBeInTheDocument();
  });

  it("displays logo image", () => {
    render(
      <MemoryRouter>
        <CheckEmail />
      </MemoryRouter>
    );

    const logo = screen.getByAltText("@Cloud");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("src", "/Cloud-removebg.png");
  });

  it("shows spam folder warning", () => {
    render(
      <MemoryRouter>
        <CheckEmail />
      </MemoryRouter>
    );

    expect(screen.getByText(/spam folder/i)).toBeInTheDocument();
  });

  it("shows email address when provided via location state", () => {
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/check-email", state: { email: "test@example.com" } },
        ]}
      >
        <CheckEmail />
      </MemoryRouter>
    );

    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("shows email input field when no email in state", () => {
    render(
      <MemoryRouter>
        <CheckEmail />
      </MemoryRouter>
    );

    const emailInput = screen.getByPlaceholderText("Enter your email address");
    expect(emailInput).toBeInTheDocument();
  });

  it("disables resend button when no email provided", () => {
    render(
      <MemoryRouter>
        <CheckEmail />
      </MemoryRouter>
    );

    const resendButton = screen.getByText("Resend Verification Email");
    expect(resendButton).toBeDisabled();
  });

  it("enables resend button after entering email", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CheckEmail />
      </MemoryRouter>
    );

    const emailInput = screen.getByPlaceholderText("Enter your email address");
    const resendButton = screen.getByText("Resend Verification Email");

    expect(resendButton).toBeDisabled();

    await user.type(emailInput, "new@example.com");

    expect(resendButton).not.toBeDisabled();
  });

  it("sends resend verification email successfully with email from state", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const user = userEvent.setup();

    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/check-email", state: { email: "test@example.com" } },
        ]}
      >
        <CheckEmail />
      </MemoryRouter>
    );

    const resendButton = screen.getByText("Resend Verification Email");
    await user.click(resendButton);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/auth/resend-verification"),
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: "test@example.com" }),
        })
      );
    });

    expect(mockSuccess).toHaveBeenCalledWith(
      "Verification email sent! Please check your inbox and spam folder.",
      expect.objectContaining({
        title: "Email Sent",
      })
    );
  });

  it("sends resend verification email successfully with entered email", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CheckEmail />
      </MemoryRouter>
    );

    const emailInput = screen.getByPlaceholderText("Enter your email address");
    await user.type(emailInput, "typed@example.com");

    const resendButton = screen.getByText("Resend Verification Email");
    await user.click(resendButton);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/auth/resend-verification"),
        expect.objectContaining({
          body: JSON.stringify({ email: "typed@example.com" }),
        })
      );
    });

    expect(mockSuccess).toHaveBeenCalled();
  });

  it("shows loading state while sending email", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const user = userEvent.setup();

    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/check-email", state: { email: "test@example.com" } },
        ]}
      >
        <CheckEmail />
      </MemoryRouter>
    );

    const resendButton = screen.getByText("Resend Verification Email");
    await user.click(resendButton);

    expect(screen.getByText("Sending...")).toBeInTheDocument();
    expect(resendButton).toBeDisabled();
  });

  it("handles resend email failure with error message from server", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        message: "Email not found",
      }),
    });

    const user = userEvent.setup();

    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/check-email", state: { email: "test@example.com" } },
        ]}
      >
        <CheckEmail />
      </MemoryRouter>
    );

    const resendButton = screen.getByText("Resend Verification Email");
    await user.click(resendButton);

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        "Email not found",
        expect.objectContaining({
          title: "Send Failed",
        })
      );
    });
  });

  it("handles resend email failure without error message", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false }),
    });

    const user = userEvent.setup();

    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/check-email", state: { email: "test@example.com" } },
        ]}
      >
        <CheckEmail />
      </MemoryRouter>
    );

    const resendButton = screen.getByText("Resend Verification Email");
    await user.click(resendButton);

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        "Failed to resend verification email. Please try again.",
        expect.objectContaining({
          title: "Send Failed",
        })
      );
    });
  });

  it("handles network error during resend", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Network error")
    );

    const user = userEvent.setup();

    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/check-email", state: { email: "test@example.com" } },
        ]}
      >
        <CheckEmail />
      </MemoryRouter>
    );

    const resendButton = screen.getByText("Resend Verification Email");
    await user.click(resendButton);

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        "Failed to resend verification email. Please try again.",
        expect.objectContaining({
          title: "Send Failed",
        })
      );
    });

    consoleErrorSpy.mockRestore();
  });

  it("trims whitespace from entered email", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CheckEmail />
      </MemoryRouter>
    );

    const emailInput = screen.getByPlaceholderText("Enter your email address");
    await user.type(emailInput, "  spaced@example.com  ");

    const resendButton = screen.getByText("Resend Verification Email");
    await user.click(resendButton);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ email: "spaced@example.com" }),
        })
      );
    });
  });

  it("renders link to login page", () => {
    render(
      <MemoryRouter>
        <CheckEmail />
      </MemoryRouter>
    );

    const loginLink = screen.getByText(
      /I've verified my email - Take me to Login/i
    );
    expect(loginLink).toBeInTheDocument();
    expect(loginLink.closest("a")).toHaveAttribute("href", "/login");
  });

  it("shows verification link expiration notice", () => {
    render(
      <MemoryRouter>
        <CheckEmail />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/The verification link will expire in 24 hours/i)
    ).toBeInTheDocument();
  });

  it("shows contact support link", () => {
    render(
      <MemoryRouter>
        <CheckEmail />
      </MemoryRouter>
    );

    expect(screen.getByText(/Having trouble/i)).toBeInTheDocument();
    const supportLink = screen.getByText("Contact support");
    expect(supportLink.closest("a")).toHaveAttribute("href", "/login");
  });

  it("does not show email input when email is provided in state", () => {
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/check-email", state: { email: "test@example.com" } },
        ]}
      >
        <CheckEmail />
      </MemoryRouter>
    );

    expect(
      screen.queryByPlaceholderText("Enter your email address")
    ).not.toBeInTheDocument();
  });
});
