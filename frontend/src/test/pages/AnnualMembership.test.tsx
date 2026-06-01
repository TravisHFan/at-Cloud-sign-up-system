import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import AnnualMemberships from "../../pages/AnnualMemberships";
import AnnualMembershipDetail from "../../pages/AnnualMembershipDetail";
import AnnualMembershipForm from "../../pages/AnnualMembershipForm";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: {} as Record<string, string | undefined>,
  currentUser: { id: "user-1", role: "Participant" } as {
    id: string;
    role: string;
  },
  annualMembershipService: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    createCheckoutSession: vi.fn(),
  },
  programService: {
    list: vi.fn(),
  },
}));

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    currentUser: mocks.currentUser,
  }),
}));

vi.mock("../../services/api", () => ({
  annualMembershipService: mocks.annualMembershipService,
  programService: mocks.programService,
}));

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useParams: () => mocks.params,
  };
});

const membership = {
  id: "membership-1",
  title: "2026-2027 NextGen Annual Membership",
  price: 10000,
  isActive: true,
  purchased: false,
  adminAccess: false,
  programs: [
    {
      id: "program-1",
      title: "Program A",
      programType: "NextGen",
      fullPriceTicket: 8000,
    },
    {
      id: "program-2",
      title: "Program B",
      programType: "Webinar",
      fullPriceTicket: 5000,
    },
  ],
};

function renderWithRouter(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("Annual Membership pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.params = {};
    mocks.currentUser = { id: "user-1", role: "Participant" };
    mocks.annualMembershipService.list.mockResolvedValue([membership]);
    mocks.annualMembershipService.getById.mockResolvedValue(membership);
    mocks.annualMembershipService.create.mockResolvedValue(membership);
    mocks.annualMembershipService.update.mockResolvedValue(membership);
    mocks.annualMembershipService.createCheckoutSession.mockResolvedValue({
      sessionId: "cs_test_membership",
      sessionUrl: "#membership-checkout",
      purchaseId: "purchase-1",
      orderNumber: "ORD-1",
    });
    mocks.programService.list.mockResolvedValue([]);
  });

  afterEach(() => {
    window.location.hash = "";
  });

  it("renders membership cards with purchase status and price", async () => {
    renderWithRouter(<AnnualMemberships />);

    expect(
      await screen.findByText("2026-2027 NextGen Annual Membership"),
    ).toBeInTheDocument();
    expect(screen.getByText("$100.00")).toBeInTheDocument();
    expect(screen.getByText("2 included programs")).toBeInTheDocument();
    expect(screen.getByText("Program A, Program B")).toBeInTheDocument();
    expect(screen.getByText("Enroll")).toBeInTheDocument();
  });

  it("lets administrators enter the create membership flow", async () => {
    mocks.currentUser = { id: "admin-1", role: "Administrator" };
    renderWithRouter(<AnnualMemberships />);

    expect(await screen.findByText("New Membership")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /new membership/i }),
    );

    expect(mocks.navigate).toHaveBeenCalledWith(
      "/dashboard/annual-memberships/new",
    );
  });

  it("shows membership details and starts checkout from the detail page", async () => {
    mocks.params = { id: "membership-1" };
    const user = userEvent.setup();

    renderWithRouter(<AnnualMembershipDetail />);

    expect(
      await screen.findByRole("heading", {
        name: "2026-2027 NextGen Annual Membership",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Program A")).toBeInTheDocument();
    expect(screen.getByText("Program B")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /purchase membership - \$100\.00/i }),
    );

    await waitFor(() =>
      expect(
        mocks.annualMembershipService.createCheckoutSession,
      ).toHaveBeenCalledWith("membership-1"),
    );
  });

  it("creates a membership with sortable, paginated program selection", async () => {
    const programs = Array.from({ length: 25 }, (_, index) => {
      const number = String(index + 1).padStart(2, "0");
      return {
        id: `program-${number}`,
        title: `Program ${number}`,
        programType: index % 2 === 0 ? "NextGen" : "Webinar",
        fullPriceTicket: 5000 + index,
        period: {
          startYear: "2026",
          startMonth: number,
        },
      };
    });
    mocks.programService.list.mockResolvedValue(programs);
    mocks.annualMembershipService.create.mockResolvedValue({
      ...membership,
      id: "saved-membership",
    });
    const user = userEvent.setup();

    renderWithRouter(<AnnualMembershipForm />);

    expect(await screen.findByText("Program 01")).toBeInTheDocument();
    expect(screen.getByText("Program 20")).toBeInTheDocument();
    expect(screen.queryByText("Program 21")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(await screen.findByText("Program 21")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /previous/i }));

    await user.type(screen.getByLabelText(/title/i), "Annual Suite");
    await user.type(screen.getByLabelText(/price/i), "100.00");
    await user.click(screen.getByLabelText(/Program 01/i));
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() =>
      expect(mocks.annualMembershipService.create).toHaveBeenCalledWith({
        title: "Annual Suite",
        price: 10000,
        programIds: ["program-01"],
        isActive: true,
      }),
    );
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/dashboard/annual-memberships/saved-membership",
    );
  });
});
