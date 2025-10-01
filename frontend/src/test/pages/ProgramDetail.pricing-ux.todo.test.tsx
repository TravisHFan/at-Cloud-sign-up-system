import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
// Mock Auth context for these tests
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    currentUser: { id: "u-admin", role: "Administrator" },
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

describe("ProgramDetail Pricing UX", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("shows pricing panel when program.pricing exists and renders examples", async () => {
    const mockedProgramService = {
      getById: vi.fn(async () => ({
        id: "p1",
        title: "ECW 2025",
        programType: "Effective Communication Workshops",
        pricing: {
          fullPriceTicket: 1000,
          classRepDiscount: 100,
          earlyBirdDiscount: 200,
        },
      })),
      listEvents: vi.fn(async () => []),
    };

    vi.doMock("../../services/api", () => ({
      programService: mockedProgramService,
    }));

    vi.doMock("react-router-dom", async () => {
      const actual = await vi.importActual<typeof import("react-router-dom")>(
        "react-router-dom"
      );
      return {
        ...actual,
        useNavigate: () => vi.fn(),
        useParams: () => ({ id: "p1" }),
      };
    });

    const { default: Page } = await import("../../pages/ProgramDetail");
    const { NotificationProvider } = await import(
      "../../contexts/NotificationModalContext"
    );

    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={["/dashboard/programs/p1"]}>
          <Routes>
            <Route path="/dashboard/programs/:id" element={<Page />} />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );

    expect(
      await screen.findByRole("heading", { name: /tuition/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Full Price Ticket/i)).toBeInTheDocument();
    expect(screen.getByText(/Class Rep Discount/i)).toBeInTheDocument();
    expect(screen.getByText(/Early Bird Discount/i)).toBeInTheDocument();

    // Examples (query more specifically to avoid label collisions)
    // The label is a div, and the examples list (<ul>) is a sibling inside the parent container.
    // Use the parent container to scope our queries.
    const examplesContainer =
      screen.getByText(/Computed Examples/i).parentElement!;
    expect(
      within(examplesContainer).getByText(/Standard/i)
    ).toBeInTheDocument();
    expect(
      within(examplesContainer).getByText(/^Class Rep$/i)
    ).toBeInTheDocument();
    expect(
      within(examplesContainer).getByText(/^Early Bird$/i)
    ).toBeInTheDocument();
    expect(
      within(examplesContainer).getByText(/Rep \+ Early Bird/i)
    ).toBeInTheDocument();

    // Currency formatted (hedge by checking $1,000 and $900 etc.)
    expect(screen.getAllByText(/\$1,000\.00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\$900\.00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\$800\.00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\$700\.00/).length).toBeGreaterThan(0);
  });

  it("shows a soft message when pricing is missing", async () => {
    const mockedProgramService = {
      getById: vi.fn(async () => ({
        id: "p1",
        title: "ECW 2025",
        programType: "Effective Communication Workshops",
      })),
      listEvents: vi.fn(async () => []),
    };

    vi.doMock("../../services/api", () => ({
      programService: mockedProgramService,
    }));

    vi.doMock("react-router-dom", async () => {
      const actual = await vi.importActual<typeof import("react-router-dom")>(
        "react-router-dom"
      );
      return {
        ...actual,
        useNavigate: () => vi.fn(),
        useParams: () => ({ id: "p1" }),
      };
    });

    const { default: Page } = await import("../../pages/ProgramDetail");
    const { NotificationProvider } = await import(
      "../../contexts/NotificationModalContext"
    );

    render(
      <NotificationProvider>
        <MemoryRouter initialEntries={["/dashboard/programs/p1"]}>
          <Routes>
            <Route path="/dashboard/programs/:id" element={<Page />} />
          </Routes>
        </MemoryRouter>
      </NotificationProvider>
    );

    expect(
      await screen.findByRole("heading", { name: /tuition/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Tuition is being set up/i)).toBeInTheDocument();
  });
});
