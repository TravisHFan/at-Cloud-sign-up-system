import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../../contexts/AuthContext";
import { NotificationProvider } from "../../contexts/NotificationModalContext";
import NewEvent from "../../pages/CreateEvent";

// Mock backend templates to a known event type and role baseline
const mockedEventService = vi.hoisted(() => ({
  getEventTemplates: vi.fn().mockResolvedValue({
    allowedTypes: ["Conference"],
    templates: {
      Conference: [
        {
          name: "Attendee",
          description: "General attendee",
          maxParticipants: 100,
        },
        { name: "Host", description: "Event host", maxParticipants: 1 },
      ],
    },
  }),
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

    // Find the Host role card (template max = 1, 3× = 3)
    const roleHeading = await screen.findByRole("heading", { name: "Host" });
    // The heading lives in a child div (flex-1). We need the parent role card container
    const roleCard = (roleHeading.closest("div")?.parentElement ||
      roleHeading.parentElement) as HTMLElement;
    // Target the numeric input within that role card container
    const input = within(roleCard).getByRole("spinbutton") as HTMLInputElement;
    // Set to 4 (> 3×)
    fireEvent.change(input, { target: { value: "4" } });

    // Warning should appear
    await screen.findByText(
      /exceeds recommended limit of 3 participants for Host/i
    );

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
          (r: any) => r.name === "Host" && r.maxParticipants === 4
        )
      ).toBe(true);
    });
  });
});
