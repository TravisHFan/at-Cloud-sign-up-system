import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { NotificationProvider } from "../../contexts/NotificationModalContext";

const mockedProgramService = vi.hoisted(() => ({
  getById: vi.fn(async () => ({
    id: "p1",
    title: "EMBA 2025",
    programType: "EMBA Mentor Circles",
  })),
  listEvents: vi.fn(async () => [
    {
      id: "e1",
      title: "A",
      type: "Mentor Circle",
      date: "2025-01-01",
      time: "10:00",
      endTime: "11:00",
      roles: [],
      signedUp: 0,
      totalSlots: 0,
      format: "Online",
      createdBy: "u1",
      createdAt: new Date().toISOString(),
    },
    {
      id: "e2",
      title: "B",
      type: "Mentor Circle",
      date: "2025-01-02",
      time: "10:00",
      endTime: "11:00",
      roles: [],
      signedUp: 0,
      totalSlots: 0,
      format: "Online",
      createdBy: "u1",
      createdAt: new Date().toISOString(),
    },
  ]),
  listEventsPaged: vi.fn(async () => ({
    items: [],
    page: 1,
    limit: 20,
    total: 2,
    totalPages: 1,
  })),
  remove: vi.fn(async () => ({ success: true })),
}));

vi.mock("../../services/api", () => ({ programService: mockedProgramService }));

// Mock Auth context so ProgramDetail doesn't require a real AuthProvider
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: { id: "admin", role: "Administrator" },
    isAuthenticated: true,
    isLoading: false,
    hasRole: () => true,
    canCreateEvents: true,
    canManageUsers: true,
    login: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
  }),
}));

// Stable route context
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: "p1" }),
  };
});

describe("ProgramDetail delete modal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Delete button for Administrator and opens modal", async () => {
    const { default: Page } = await import("../../pages/ProgramDetail");
    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={["/dashboard/programs/p1"]}>
          <Routes>
            <Route
              path="/dashboard/programs/:id"
              element={<Page forceServerPagination={false} />}
            />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );

    await waitFor(() =>
      expect(mockedProgramService.getById).toHaveBeenCalled()
    );
    const delBtn = await screen.findByRole("button", {
      name: /delete program/i,
    });
    expect(delBtn).toBeInTheDocument();
    fireEvent.click(delBtn);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/delete program only/i)).toBeInTheDocument();
    expect(
      screen.getByText(/delete program and all linked events/i)
    ).toBeInTheDocument();
  });

  it("performs unlink-only delete by default", async () => {
    const { default: Page } = await import("../../pages/ProgramDetail");
    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={["/dashboard/programs/p1"]}>
          <Routes>
            <Route
              path="/dashboard/programs/:id"
              element={<Page forceServerPagination={false} />}
            />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );
    await screen.findByText(/emba 2025/i);
    fireEvent.click(
      await screen.findByRole("button", { name: /delete program/i })
    );
    const dialog = await screen.findByRole("dialog");
    const continueBtn = within(dialog).getByRole("button", {
      name: /continue/i,
    });
    fireEvent.click(continueBtn);

    // Now in final confirmation modal
    const finalDialog = await screen.findByRole("dialog");
    const confirmBtn = within(finalDialog).getByRole("button", {
      name: /yes, delete/i,
    });
    fireEvent.click(confirmBtn);

    await waitFor(() =>
      expect(mockedProgramService.remove).toHaveBeenCalledWith("p1", {
        deleteLinkedEvents: false,
      })
    );
  });

  it("performs cascade delete when selected", async () => {
    const { default: Page } = await import("../../pages/ProgramDetail");
    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={["/dashboard/programs/p1"]}>
          <Routes>
            <Route
              path="/dashboard/programs/:id"
              element={<Page forceServerPagination={false} />}
            />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );
    await screen.findByText(/emba 2025/i);
    fireEvent.click(
      await screen.findByRole("button", { name: /delete program/i })
    );
    const dialog = await screen.findByRole("dialog");
    const cascadeOption = within(dialog).getByLabelText(
      /delete program and all linked events/i,
      { selector: 'input[type="radio"]' }
    );
    fireEvent.click(cascadeOption);
    const continueBtn = within(dialog).getByRole("button", {
      name: /continue/i,
    });
    fireEvent.click(continueBtn);

    // Now in final confirmation modal
    const finalDialog = await screen.findByRole("dialog");
    const confirmBtn = within(finalDialog).getByRole("button", {
      name: /yes, delete/i,
    });
    fireEvent.click(confirmBtn);

    await waitFor(() =>
      expect(mockedProgramService.remove).toHaveBeenCalledWith("p1", {
        deleteLinkedEvents: true,
      })
    );
  });
});
