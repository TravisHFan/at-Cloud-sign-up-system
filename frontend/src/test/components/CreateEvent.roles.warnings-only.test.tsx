import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../../contexts/AuthContext";
import { NotificationProvider } from "../../contexts/NotificationModalContext";
import NewEvent from "../../pages/CreateEvent";

// Mock services
const mockedEventService = vi.hoisted(() => ({
  createEvent: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("../../services/api", () => ({
  eventService: mockedEventService,
  fileService: { uploadImage: vi.fn() },
  authService: {
    getProfile: vi.fn().mockResolvedValue({
      id: "u1",
      username: "testuser",
      firstName: "Test",
      lastName: "User",
      email: "test@example.com",
      phone: "1234567890",
      role: "Leader",
      isAtCloudLeader: true,
      roleInAtCloud: "Leader",
      gender: "male",
    }),
  },
  programService: {
    list: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue({}),
  },
  userService: {
    getUsers: vi.fn().mockResolvedValue({ users: [] }),
  },
}));

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      <NotificationProvider>{children}</NotificationProvider>
    </AuthProvider>
  </BrowserRouter>
);

describe("CreateEvent — role cap warnings-only behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("authToken", "test-token");
  });

  it("shows a warning when a role exceeds 3× but still allows submit", async () => {
    render(
      <Wrapper>
        <NewEvent />
      </Wrapper>
    );

    // Wait for templates and set required fields
    const typeSelect = await screen.findByLabelText(/event type/i);

    fireEvent.change(screen.getByLabelText(/event title/i), {
      target: { value: "Warning Only Capacity" },
    });
    fireEvent.change(typeSelect, { target: { value: "Conference" } });

    // Wait for template selector to appear and apply template
    await waitFor(() => {
      expect(screen.getByText(/choose a roles template/i)).toBeInTheDocument();
    });

    // Select the Conference template
    const templateSelect = screen.getByRole("combobox", {
      name: /choose.*template/i,
    });
    fireEvent.change(templateSelect, { target: { value: "tpl1" } });

    // Confirm template
    const confirmButton = screen.getByRole("button", {
      name: /confirm template/i,
    });
    fireEvent.click(confirmButton);

    // Wait for roles to appear
    await waitFor(() => {
      expect(screen.getByText("Host")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/time zone/i), {
      target: { value: "America/Los_Angeles" },
    });

    const d = new Date();
    d.setDate(d.getDate() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;

    fireEvent.change(screen.getByLabelText(/start date/i), {
      target: { value: dateStr },
    });
    fireEvent.change(screen.getByLabelText(/start time/i), {
      target: { value: "10:00" },
    });
    fireEvent.change(screen.getByLabelText(/end date/i), {
      target: { value: dateStr },
    });
    fireEvent.change(screen.getByLabelText(/end time/i), {
      target: { value: "11:00" },
    });
    fireEvent.change(screen.getByLabelText(/^format/i), {
      target: { value: "Online" },
    });

    fireEvent.change(screen.getByLabelText(/event agenda and schedule/i), {
      target: { value: "Agenda: welcome and session" },
    });

    // Find the Host role card
    const roleHeading = await screen.findByRole("heading", { name: "Host" });
    // Prefer accessible query: find the capacity input by its aria-label
    const input = screen.getByLabelText(
      new RegExp(`^Max participants for ${roleHeading.textContent}$`, "i")
    ) as HTMLInputElement;
    // Set to 250 (> 200 max allowed)
    fireEvent.change(input, { target: { value: "250" } });

    // Warning should appear
    await screen.findByText(/exceeds maximum allowed 200 participants/i);

    // Open preview so we can submit via the preview flow
    fireEvent.click(screen.getByRole("button", { name: /preview/i }));
    await screen.findByText(/event preview/i);

    const submitBtn = screen.getByRole("button", { name: /create event/i });
    expect(submitBtn).toBeEnabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockedEventService.createEvent).toHaveBeenCalled();
      const payload = mockedEventService.createEvent.mock.calls[0][0];
      expect(
        payload.roles.some(
          (r: any) => r.name === "Host" && r.maxParticipants === 250
        )
      ).toBe(true);
    });
  });
});
