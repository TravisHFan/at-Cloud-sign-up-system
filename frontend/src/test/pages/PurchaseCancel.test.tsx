import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PurchaseCancel from "../../pages/PurchaseCancel";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("PurchaseCancel page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders cancel message and icon", () => {
    render(
      <MemoryRouter initialEntries={["/?program_id=prog123"]}>
        <Routes>
          <Route path="/" element={<PurchaseCancel />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/payment cancelled/i)).toBeInTheDocument();
    expect(screen.getByText(/you have not been charged/i)).toBeInTheDocument();
  });

  it("shows informational messages about cancellation", () => {
    render(
      <MemoryRouter initialEntries={["/?program_id=prog123"]}>
        <Routes>
          <Route path="/" element={<PurchaseCancel />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/what happened\?/i)).toBeInTheDocument();
    expect(
      screen.getByText(/you cancelled the payment process/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/want to enroll later\?/i)).toBeInTheDocument();
  });

  it("shows Try Again button when program_id is present", () => {
    render(
      <MemoryRouter initialEntries={["/?program_id=prog123"]}>
        <Routes>
          <Route path="/" element={<PurchaseCancel />} />
        </Routes>
      </MemoryRouter>
    );

    expect(
      screen.getByRole("button", { name: /try again/i })
    ).toBeInTheDocument();
  });

  it("navigates to enrollment page when Try Again clicked", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/?program_id=prog123"]}>
        <Routes>
          <Route path="/" element={<PurchaseCancel />} />
        </Routes>
      </MemoryRouter>
    );

    const tryAgainButton = screen.getByRole("button", { name: /try again/i });
    await user.click(tryAgainButton);

    expect(mockNavigate).toHaveBeenCalledWith(
      "/dashboard/programs/prog123/enroll"
    );
  });

  it("navigates to program detail when Back to Program clicked with program_id", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/?program_id=prog123"]}>
        <Routes>
          <Route path="/" element={<PurchaseCancel />} />
        </Routes>
      </MemoryRouter>
    );

    const backButton = screen.getByRole("button", { name: /back to program/i });
    await user.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/programs/prog123");
  });

  it("navigates to programs list when no program_id present", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<PurchaseCancel />} />
        </Routes>
      </MemoryRouter>
    );

    const backButton = screen.getByRole("button", {
      name: /browse programs/i,
    });
    await user.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/programs");
  });
});
