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
        perspective="inviter"
      />
    );

    fireEvent.change(screen.getByLabelText(/Guest's Full name/i), {
      target: { value: "Jane" },
    });
    fireEvent.change(screen.getByLabelText(/Guest's Gender/i), {
      target: { value: "female" },
    });
    fireEvent.change(screen.getByLabelText(/Guest's Email/i), {
      target: { value: "jane@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/Guest's Phone/i), {
      target: { value: "+1 555-0000" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Register Guest/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(GuestApi.signup).toHaveBeenCalledWith(
      "e1",
      expect.objectContaining({ roleId: "role1" })
    );
  });

  it("shows error on failure", async () => {
    (GuestApi.signup as any).mockRejectedValue(new Error("boom"));
    render(
      <GuestRegistrationForm
        eventId="e2"
        roleId="role2"
        perspective="inviter"
      />
    );

    fireEvent.change(screen.getByLabelText(/Guest's Full name/i), {
      target: { value: "John" },
    });
    fireEvent.change(screen.getByLabelText(/Guest's Gender/i), {
      target: { value: "male" },
    });
    fireEvent.change(screen.getByLabelText(/Guest's Email/i), {
      target: { value: "john@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/Guest's Phone/i), {
      target: { value: "+1 222-3333" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Register Guest/i }));

    await waitFor(() => screen.getByText(/boom/i));
  });

  it("requires phone in UI (shows message if missing)", async () => {
    (GuestApi.signup as any).mockResolvedValue({ registrationId: "r2" });
    render(
      <GuestRegistrationForm
        eventId="e3"
        roleId="role3"
        perspective="inviter"
      />
    );

    fireEvent.change(screen.getByLabelText(/Guest's Full name/i), {
      target: { value: "No Phone" },
    });
    // Use ID to target the gender select element directly
    fireEvent.change(
      screen.getByRole("combobox", { name: /Guest's Gender/i }),
      {
        target: { value: "female" },
      }
    );
    fireEvent.change(screen.getByLabelText(/Guest's Email Address/i), {
      target: { value: "nophone@example.com" },
    });
    // Do NOT set phone field
    fireEvent.click(screen.getByRole("button", { name: /Register Guest/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/Please provide the guest's phone number\./i)
      ).toBeInTheDocument()
    );
    expect(GuestApi.signup).not.toHaveBeenCalled();
  });
});
