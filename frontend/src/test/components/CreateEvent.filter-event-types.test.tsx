import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../../contexts/AuthContext";
import { NotificationProvider } from "../../contexts/NotificationModalContext";
import NewEvent from "../../pages/CreateEvent";

// Mocks
const mockedEventService = vi.hoisted(() => ({
  getEventTemplates: vi.fn().mockResolvedValue({
    allowedTypes: [
      "Mentor Circle",
      "Effective Communication Workshop",
      "Conference",
      "Webinar",
    ],
    templates: {
      "Mentor Circle": [
        { name: "Mentor", description: "", maxParticipants: 5 },
        { name: "Attendee", description: "", maxParticipants: 30 },
      ],
      "Effective Communication Workshop": [
        { name: "Attendee", description: "", maxParticipants: 100 },
      ],
      Conference: [{ name: "Attendee", description: "", maxParticipants: 200 }],
      Webinar: [{ name: "Attendee", description: "", maxParticipants: 500 }],
    },
  }),
  createEvent: vi.fn(),
}));

const mockedProgramService = vi.hoisted(() => ({
  list: vi
    .fn()
    .mockResolvedValue([
      { id: "p1", title: "EMBA 2025", programType: "EMBA Mentor Circles" },
    ]),
  getById: vi.fn().mockResolvedValue({ mentors: [] }),
}));

vi.mock("../../services/api", () => ({
  eventService: mockedEventService,
  programService: mockedProgramService,
  userService: { getUsers: vi.fn().mockResolvedValue({ users: [], total: 0 }) },
  authService: {
    getProfile: vi.fn().mockResolvedValue({
      id: "u1",
      username: "admin",
      firstName: "Admin",
      lastName: "User",
      email: "admin@example.com",
      phone: "",
      role: "Administrator",
      isAtCloudLeader: true,
      roleInAtCloud: "Administrator",
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

describe("CreateEvent - Event Type filtering by Program Type", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("authToken", "test-token");
  });

  it("hides 'Effective Communication Workshop' when Program Type is 'EMBA Mentor Circles'", async () => {
    render(
      <Wrapper>
        <NewEvent />
      </Wrapper>
    );

    // Wait for templates and programs
    const programSelect = await screen.findByLabelText(/program/i);
    const typeSelect = await screen.findByLabelText(/event type/i);

    // Select EMBA program in multi-select by setting option.selected = true
    const p1Option = within(programSelect as HTMLElement).getByRole("option", {
      name: /EMBA 2025/i,
    }) as HTMLOptionElement;
    p1Option.selected = true;
    fireEvent.change(programSelect);
    await waitFor(() => expect(p1Option.selected).toBe(true));

    // Open the options list by focusing the select; then assert options
    // Note: in JSDOM, options are always present in the DOM
    const options = within(typeSelect).getAllByRole("option");
    const optionTexts = options.map((o) =>
      (o as HTMLOptionElement).textContent?.trim()
    );

    expect(optionTexts).toContain("Mentor Circle");
    expect(optionTexts).toContain("Conference");
    expect(optionTexts).toContain("Webinar");
    expect(optionTexts).not.toContain("Effective Communication Workshop");
  });
});
