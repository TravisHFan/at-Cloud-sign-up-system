import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import GuestManage from "../../pages/GuestManage";

// Mock API
vi.mock("../../services/guestApi", () => ({
  __esModule: true,
  default: {
    getByToken: vi.fn(async (token: string) => {
      if (token === "bad") throw new Error("Invalid or expired link");
      if (token === "empty") return { guest: null } as any;
      return {
        guest: {
          id: "g1",
          status: "active",
          fullName: "Jane Guest",
          phone: "+1 555 000 1111",
          notes: "Hi",
          eventSnapshot: { title: "Z Event", roleName: "Host" },
        },
      };
    }),
    updateByToken: vi.fn(async (_token: string, payload: any) => ({
      id: "g1",
      status: "active",
      fullName: payload?.fullName || "Jane Guest",
      phone: payload?.phone || "+1 555 000 1111",
      notes: payload?.notes || "Hi",
      eventSnapshot: { title: "Z Event", roleName: "Host" },
    })),
    cancelByToken: vi.fn(async (_token: string) => ({})),
  },
}));

// No need to mock navigate; we assert route changes by rendering the target route

describe("GuestManage page", () => {
  const renderWith = (initial: string) =>
    render(
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/guest/manage/:token" element={<GuestManage />} />
          <Route path="/guest/confirmation" element={<div>CONFIRMED</div>} />
        </Routes>
      </MemoryRouter>
    );

  it("shows loading then data, allows update", async () => {
    const user = userEvent.setup();
    renderWith("/guest/manage/good");

    expect(screen.getByText(/Loading/i)).toBeInTheDocument();

    await waitFor(() => screen.getByText(/Manage Your Registration/i));

    // First textbox corresponds to Full name in this simple form
    const name = screen.getAllByRole("textbox")[0] as HTMLInputElement;
    await user.clear(name);
    await user.type(name, "Jane Updated");

    const saveBtn = screen.getByRole("button", { name: /Save Changes/i });
    await user.click(saveBtn);

    // Verify API called with updated value
    const api = await import("../../services/guestApi");
    await waitFor(() => {
      expect((api.default as any).updateByToken).toHaveBeenCalledWith(
        "good",
        expect.objectContaining({ fullName: "Jane Updated" })
      );
    });

    // UI reflects updated value
    await waitFor(() => {
      const updatedName = screen.getAllByRole("textbox")[0] as HTMLInputElement;
      expect(updatedName.value).toBe("Jane Updated");
    });
  });

  it("renders invalid token error", async () => {
    renderWith("/guest/manage/bad");
    await waitFor(() => screen.getByText(/Invalid or expired link/i));
  });

  it("renders not found state when no guest returned", async () => {
    renderWith("/guest/manage/empty");
    await waitFor(() => screen.getByText(/Registration not found/i));
  });

  it("confirms then navigates on cancel", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/guest/manage/good"]}>
        <Routes>
          <Route path="/guest/manage/:token" element={<GuestManage />} />
          <Route path="/guest/confirmation" element={<div>CONFIRMED</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => screen.getByText(/Manage Your Registration/i));

    const cancelBtn = screen.getByRole("button", {
      name: /Cancel Registration/i,
    });
    await user.click(cancelBtn);

    // Confirm in modal
    const confirmModalBtn = await screen.findByRole("button", {
      name: /Yes, Cancel Registration/i,
    });
    await user.click(confirmModalBtn);

    await waitFor(() => screen.getByText(/CONFIRMED/i));
  });

  it("uses rotated manage token for subsequent cancel after save", async () => {
    const user = userEvent.setup();

    // Re-mock updateByToken to return a rotated token
    const api = await import("../../services/guestApi");
    (api.default as any).updateByToken.mockResolvedValueOnce({
      id: "g1",
      status: "active",
      fullName: "Jane Rotated",
      phone: "+1 555 000 1111",
      notes: "Hi",
      eventSnapshot: { title: "Z Event", roleName: "Host" },
      manageToken: "rotated123",
    });

    render(
      <MemoryRouter initialEntries={["/guest/manage/good"]}>
        <Routes>
          <Route path="/guest/manage/:token" element={<GuestManage />} />
          <Route path="/guest/confirmation" element={<div>CONFIRMED</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => screen.getByText(/Manage Your Registration/i));

    // Trigger a save to rotate token
    const name = screen.getAllByRole("textbox")[0] as HTMLInputElement;
    await user.clear(name);
    await user.type(name, "Jane Rotated");
    await user.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => {
      expect((api.default as any).updateByToken).toHaveBeenCalledWith(
        "good",
        expect.objectContaining({ fullName: "Jane Rotated" })
      );
    });

    // Now cancel, should use rotated token
    await user.click(
      screen.getByRole("button", { name: /Cancel Registration/i })
    );

    const confirmModalBtn = await screen.findByRole("button", {
      name: /Yes, Cancel Registration/i,
    });
    await user.click(confirmModalBtn);

    await waitFor(() => {
      expect((api.default as any).cancelByToken).toHaveBeenCalledWith(
        "rotated123"
      );
    });

    await waitFor(() => screen.getByText(/CONFIRMED/i));
  });
});
