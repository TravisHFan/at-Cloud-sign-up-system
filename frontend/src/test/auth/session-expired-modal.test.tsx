import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import SessionExpiredModal from "../../components/common/SessionExpiredModal";
import {
  handleSessionExpired,
  __resetSessionPromptFlag,
} from "../../services/session";

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("SessionExpiredModal", () => {
  beforeEach(() => {
    __resetSessionPromptFlag();
    mockNavigate.mockClear();
    localStorage.setItem("authToken", "test-token");
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("shows custom modal when session expires", async () => {
    render(
      <BrowserRouter>
        <SessionExpiredModal />
      </BrowserRouter>
    );

    // Initially, modal should not be visible
    expect(screen.queryByText("Session Expired")).not.toBeInTheDocument();

    // Trigger session expiration
    handleSessionExpired();

    // Wait for modal to appear
    await waitFor(() => {
      expect(screen.getByText("Session Expired")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Your session has expired. Please sign in again.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
  });

  it("navigates to login when Sign In button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <SessionExpiredModal />
      </BrowserRouter>
    );

    // Trigger session expiration
    handleSessionExpired();

    // Wait for modal to appear
    await waitFor(() => {
      expect(screen.getByText("Session Expired")).toBeInTheDocument();
    });

    // Click Sign In button
    const signInButton = screen.getByRole("button", { name: "Sign In" });
    await user.click(signInButton);

    // Verify navigation was called
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  it("only shows modal once even if handleSessionExpired is called multiple times", async () => {
    render(
      <BrowserRouter>
        <SessionExpiredModal />
      </BrowserRouter>
    );

    // Call handleSessionExpired multiple times
    handleSessionExpired();
    handleSessionExpired();
    handleSessionExpired();

    // Wait for modal to appear
    await waitFor(() => {
      expect(screen.getByText("Session Expired")).toBeInTheDocument();
    });

    // Modal should only appear once (no duplicate modals)
    const modals = screen.getAllByText("Session Expired");
    expect(modals).toHaveLength(1);
  });

  it("clears auth token from localStorage when session expires", async () => {
    render(
      <BrowserRouter>
        <SessionExpiredModal />
      </BrowserRouter>
    );

    expect(localStorage.getItem("authToken")).toBe("test-token");

    // Trigger session expiration
    handleSessionExpired();

    // Wait for modal to appear
    await waitFor(() => {
      expect(screen.getByText("Session Expired")).toBeInTheDocument();
    });

    // Token should be cleared
    expect(localStorage.getItem("authToken")).toBeNull();
  });
});
