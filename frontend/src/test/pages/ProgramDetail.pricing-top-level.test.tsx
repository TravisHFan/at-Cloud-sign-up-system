import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { createMockApiServices } from "../helpers/mockServices";

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

// This test verifies ProgramDetail pricing panel when pricing fields are top-level

describe("ProgramDetail Pricing (top-level fields)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("renders pricing labels, values, and computed examples from top-level fields", async () => {
    const mockServices = createMockApiServices({
      programService: {
        getById: vi.fn(async () => ({
          id: "p1",
          title: "EMBA 2025",
          programType: "EMBA Mentor Circles",
          fullPriceTicket: 100000, // in cents ($1,000.00)
          classRepDiscount: 10000, // in cents ($100.00)
          earlyBirdDiscount: 20000, // in cents ($200.00)
        })),
        getParticipants: vi.fn(async () => ({
          mentees: [],
          mentors: [],
          classReps: [],
        })),
      },
      purchaseService: {
        checkProgramAccess: vi.fn(async () => ({ hasAccess: true })),
      },
    });

    vi.doMock("../../services/api", () => mockServices);

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
    // "Early Bird Discount" appears in multiple places (label + disclaimer), use getAllByText
    expect(screen.getAllByText(/Early Bird Discount/i).length).toBeGreaterThan(
      0
    );

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
    // Mutual exclusivity: no "Rep + Early Bird" scenario
    expect(
      within(examplesContainer).queryByText(/Rep \+ Early Bird/i)
    ).not.toBeInTheDocument();

    expect(screen.getAllByText(/\$1,000\.00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\$900\.00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\$800\.00/).length).toBeGreaterThan(0);
    // No combined discount price ($700)
  });
});
