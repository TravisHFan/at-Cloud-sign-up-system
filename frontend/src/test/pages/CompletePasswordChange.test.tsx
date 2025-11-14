import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import CompletePasswordChange from "../../pages/CompletePasswordChange";
import * as completePasswordChangeHook from "../../hooks/useCompletePasswordChange";

vi.mock("../../hooks/useCompletePasswordChange");

describe("CompletePasswordChange page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state while processing", () => {
    vi.mocked(
      completePasswordChangeHook.useCompletePasswordChange
    ).mockReturnValue({
      isLoading: true,
      isSuccess: false,
      error: null,
    } as any);

    render(
      <BrowserRouter>
        <CompletePasswordChange />
      </BrowserRouter>
    );

    expect(screen.getByText(/processing password change/i)).toBeInTheDocument();
    expect(
      screen.getByText(/securely updating your password/i)
    ).toBeInTheDocument();
  });

  it("shows success message after password changed", () => {
    vi.mocked(
      completePasswordChangeHook.useCompletePasswordChange
    ).mockReturnValue({
      isLoading: false,
      isSuccess: true,
      error: null,
    } as any);

    render(
      <BrowserRouter>
        <CompletePasswordChange />
      </BrowserRouter>
    );

    expect(
      screen.getByText(/password updated successfully/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/security notice/i)).toBeInTheDocument();
  });

  it("shows error message when password change fails", () => {
    vi.mocked(
      completePasswordChangeHook.useCompletePasswordChange
    ).mockReturnValue({
      isLoading: false,
      isSuccess: false,
      error: "Invalid or expired token",
    } as any);

    render(
      <BrowserRouter>
        <CompletePasswordChange />
      </BrowserRouter>
    );

    expect(screen.getByText(/password change failed/i)).toBeInTheDocument();
    expect(screen.getByText(/invalid or expired token/i)).toBeInTheDocument();
  });
});
