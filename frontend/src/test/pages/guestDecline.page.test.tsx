import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import GuestDecline from "../../pages/GuestDecline";
import * as guestApi from "../../services/guestApi";

// Mock GuestApi methods
vi.mock("../../services/guestApi", () => {
  return {
    __esModule: true,
    default: {
      getDeclineInfo: vi.fn(),
      submitDecline: vi.fn(),
    },
  };
});

const mockedApi = guestApi.default as unknown as {
  getDeclineInfo: ReturnType<typeof vi.fn>;
  submitDecline: ReturnType<typeof vi.fn>;
};

describe("GuestDecline Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderWithToken(token: string) {
    return render(
      <MemoryRouter initialEntries={[`/guest/decline/${token}`]}>
        <Routes>
          <Route path="/guest/decline/:token" element={<GuestDecline />} />
        </Routes>
      </MemoryRouter>
    );
  }

  it("shows validation error for invalid link", async () => {
    mockedApi.getDeclineInfo.mockResolvedValueOnce({
      success: false,
      message: "Invalid decline link",
    });
    renderWithToken("badtoken");
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByText(/Invalid decline link/i)).toBeInTheDocument();
  });

  it("renders event summary and submits decline", async () => {
    mockedApi.getDeclineInfo.mockResolvedValueOnce({
      success: true,
      data: {
        registrationId: "r1",
        eventTitle: "Launch Event",
        roleName: "Guest",
        eventDate: "2025-10-02",
      },
    });
    mockedApi.submitDecline.mockResolvedValueOnce({ success: true });
    renderWithToken("goodtoken");
    await waitFor(() =>
      expect(screen.getByText(/Launch Event/)).toBeInTheDocument()
    );

    const textarea = screen.getByLabelText(/Optional reason/i);
    fireEvent.change(textarea, { target: { value: "Cannot attend" } });
    const button = screen.getByRole("button", { name: /Decline Invitation/i });
    fireEvent.click(button);

    await waitFor(() =>
      expect(screen.getByTestId("guest-decline-success")).toBeInTheDocument()
    );
    expect(mockedApi.submitDecline).toHaveBeenCalledWith(
      "goodtoken",
      "Cannot attend"
    );
  });
});
