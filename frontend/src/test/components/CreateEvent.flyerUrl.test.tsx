import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../../contexts/AuthContext";
import { NotificationProvider } from "../../contexts/NotificationModalContext";
import NewEvent from "../../pages/CreateEvent";

// Mocks
const mockedEventService = vi.hoisted(() => ({
  getEventTemplates: vi.fn().mockResolvedValue({
    allowedTypes: ["Effective Communication Workshop"],
    templates: {
      "Effective Communication Workshop": [
        {
          name: "Participant",
          description: "General participant",
          maxParticipants: 10,
        },
      ],
    },
  }),
  createEvent: vi.fn().mockResolvedValue({ success: true }),
}));

const mockUploadImage = vi.hoisted(() =>
  vi.fn(async (_file: File) => ({ url: "/uploads/images/flyer.png" }))
);

vi.mock("../../services/api", () => ({
  eventService: mockedEventService,
  fileService: { uploadImage: mockUploadImage },
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

describe("CreateEvent - flyerUrl optional + upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("authToken", "test-token");
  });

  it("submits without flyerUrl", async () => {
    render(
      <Wrapper>
        <NewEvent />
      </Wrapper>
    );

    const typeSelect = await screen.findByLabelText(/event type/i);

    fireEvent.change(screen.getByLabelText(/event title/i), {
      target: { value: "Event No Flyer" },
    });
    fireEvent.change(typeSelect, {
      target: { value: "Effective Communication Workshop" },
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
      target: { value: "Agenda: 10:00 Welcome, 10:15 Session, 11:00 Close" },
    });

    fireEvent.click(screen.getByRole("button", { name: /preview/i }));
    await screen.findByText(/event preview/i);

    fireEvent.click(screen.getByRole("button", { name: /create event/i }));

    await waitFor(() => {
      expect(mockedEventService.createEvent).toHaveBeenCalled();
      const payload = mockedEventService.createEvent.mock.calls[0][0];
      expect(payload.flyerUrl === undefined || payload.flyerUrl === "").toBe(
        true
      );
    });
  });

  it("uploads image via paper clip and sets flyerUrl + preview shows image", async () => {
    render(
      <Wrapper>
        <NewEvent />
      </Wrapper>
    );

    const typeSelect = await screen.findByLabelText(/event type/i);

    fireEvent.change(screen.getByLabelText(/event title/i), {
      target: { value: "Event With Flyer" },
    });
    fireEvent.change(typeSelect, {
      target: { value: "Effective Communication Workshop" },
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
      target: { value: "Agenda: 10:00 Welcome, 10:15 Session, 11:00 Close" },
    });

    // Find the file input by label title on the wrapper label ("Upload image")
    const uploadLabels = screen.getAllByTitle(/upload image/i);
    expect(uploadLabels.length).toBeGreaterThan(0);
    const fileInput = uploadLabels[0].querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    const file = new File(["(image bytes)"] as any, "flyer.png", {
      type: "image/png",
    });
    // Fire change event
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Paper clip calls upload and sets input value
    await waitFor(() => {
      expect(mockUploadImage).toHaveBeenCalled();
    });

    // Open preview to see image
    fireEvent.click(screen.getByRole("button", { name: /preview/i }));
    await screen.findByText(/event preview/i);
    const img = screen.getByAltText(/event flyer preview/i) as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toContain("/uploads/images/flyer.png");

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /create event/i }));
    await waitFor(() => {
      const payload = mockedEventService.createEvent.mock.calls[0][0];
      expect(payload.flyerUrl).toContain("/uploads/images/flyer.png");
    });
  });
});
