import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// Mock the authService.register call to succeed
vi.mock("../../services/api", async (orig) => {
  const actual: any = await (orig as any)();
  return {
    ...actual,
    authService: {
      ...actual.authService,
      register: vi.fn().mockResolvedValue({ success: true }),
    },
  };
});

import { NotificationProvider } from "../../contexts/NotificationModalContext";
import SignUp from "../../pages/SignUp";
import CheckEmail from "../../pages/CheckEmail";

describe("SignUp modal sequence", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows 'We’ll keep your history' until OK, then 'Welcome to @Cloud!' until OK, then navigates", async () => {
    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <NotificationProvider>
          <Routes>
            <Route path="/signup" element={<SignUp />} />
            <Route path="/check-email" element={<CheckEmail />} />
          </Routes>
        </NotificationProvider>
      </MemoryRouter>
    );

    // Fill required fields (use placeholders and display values due to markup)
    fireEvent.change(screen.getByPlaceholderText(/Choose a username/i), {
      target: { value: "johndoe" },
    });
    fireEvent.change(screen.getByPlaceholderText(/^Enter your password$/i), {
      target: { value: "Str0ngP@ss!" },
    });
    fireEvent.change(
      screen.getByPlaceholderText(/^Enter your confirm password$/i),
      {
        target: { value: "Str0ngP@ss!" },
      }
    );
    fireEvent.change(screen.getByPlaceholderText(/Enter your first name/i), {
      target: { value: "John" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Enter your last name/i), {
      target: { value: "Doe" },
    });
    // Gender select shows a disabled placeholder option that is selected initially
    fireEvent.change(screen.getByDisplayValue(/Select Gender/i), {
      target: { value: "male" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Enter your email address/i), {
      target: { value: "john@example.com" },
    });

    // isAtCloudLeader defaults to "false"; no change needed.

    // Submit the form
    fireEvent.click(screen.getByRole("button", { name: /sign up/i }));

    // First modal should appear and persist until user clicks OK
    const firstTitle = await screen.findByText(/We’ll keep your history/i);
    expect(firstTitle).toBeInTheDocument();

    // No "X" close button (showCloseButton: false), but an OK button exists
    const ok1 = screen.getByRole("button", { name: /^OK$/i });
    fireEvent.click(ok1);

    // Second modal should now appear and persist until OK
    const secondTitle = await screen.findByText(/Welcome to @Cloud!/i);
    expect(secondTitle).toBeInTheDocument();

    const ok2 = screen.getByRole("button", { name: /^OK$/i });
    fireEvent.click(ok2);

    // After closing second modal, we should navigate to Check Email page
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /Check Your Email/i })
      ).toBeInTheDocument()
    );
  });
});
