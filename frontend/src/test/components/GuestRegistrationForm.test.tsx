import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("../../services/guestApi", () => ({
  __esModule: true,
  default: {
    signup: vi.fn(),
  },
}));

import GuestApi from "../../services/guestApi";
import GuestRegistrationForm from "../../components/guest/GuestRegistrationForm";

describe("GuestRegistrationForm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("submits payload and calls onSuccess", async () => {
    (GuestApi.signup as any).mockResolvedValue({ registrationId: "r1" });
    const onSuccess = vi.fn();
    render(
      <GuestRegistrationForm
        eventId="e1"
        roleId="role1"
        onSuccess={onSuccess}
      />
    );

    fireEvent.change(screen.getByLabelText(/Full name/i), {
      target: { value: "Jane" },
    });
    fireEvent.change(screen.getByLabelText(/Gender/i), {
      target: { value: "female" },
    });
    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: "jane@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Join as Guest/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(GuestApi.signup).toHaveBeenCalledWith(
      "e1",
      expect.objectContaining({ roleId: "role1" })
    );
  });

  it("shows error on failure", async () => {
    (GuestApi.signup as any).mockRejectedValue(new Error("boom"));
    render(<GuestRegistrationForm eventId="e2" roleId="role2" />);

    fireEvent.change(screen.getByLabelText(/Full name/i), {
      target: { value: "John" },
    });
    fireEvent.change(screen.getByLabelText(/Gender/i), {
      target: { value: "male" },
    });
    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: "john@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Join as Guest/i }));

    await waitFor(() => screen.getByText(/boom/i));
  });
});
