import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import RequestPasswordChange from "../../pages/RequestPasswordChange";
import * as requestPasswordChangeHook from "../../hooks/useRequestPasswordChange";

vi.mock("../../hooks/useRequestPasswordChange");

describe("RequestPasswordChange page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders password change request form", () => {
    vi.mocked(
      requestPasswordChangeHook.useRequestPasswordChange
    ).mockReturnValue({
      register: vi.fn(),
      errors: {},
      isSubmitting: false,
      isSuccess: false,
      newPassword: "",
      onSubmit: vi.fn(),
    } as any);

    render(
      <BrowserRouter>
        <RequestPasswordChange />
      </BrowserRouter>
    );

    expect(
      screen.getByRole("heading", { name: /change password/i })
    ).toBeInTheDocument();
  });

  it("shows success message after password change requested", async () => {
    vi.mocked(
      requestPasswordChangeHook.useRequestPasswordChange
    ).mockReturnValue({
      register: vi.fn(),
      errors: {},
      isSubmitting: false,
      isSuccess: true,
      newPassword: "",
      onSubmit: vi.fn(),
    } as any);

    render(
      <BrowserRouter>
        <RequestPasswordChange />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/request sent successfully/i)
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/check your email for the confirmation link/i)
    ).toBeInTheDocument();
  });

  it("shows submitting state", () => {
    vi.mocked(
      requestPasswordChangeHook.useRequestPasswordChange
    ).mockReturnValue({
      register: vi.fn(),
      errors: {},
      isSubmitting: true,
      isSuccess: false,
      newPassword: "NewPass123!",
      onSubmit: vi.fn(),
    } as any);

    render(
      <BrowserRouter>
        <RequestPasswordChange />
      </BrowserRouter>
    );

    const submitButton = screen.getByRole("button", {
      name: /processing/i,
    });
    expect(submitButton).toBeInTheDocument();
  });
});
