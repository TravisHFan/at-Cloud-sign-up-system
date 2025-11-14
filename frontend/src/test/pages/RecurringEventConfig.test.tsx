import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import RecurringEventConfig from "../../pages/RecurringEventConfig";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    currentUser: { role: "Co-worker" },
  }),
}));

describe("RecurringEventConfig page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders page title and description", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<RecurringEventConfig />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/event configuration/i)).toBeInTheDocument();
    expect(screen.getByText(/let's start by configuring/i)).toBeInTheDocument();
  });

  it("renders recurring event question with radio buttons", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<RecurringEventConfig />} />
        </Routes>
      </MemoryRouter>
    );

    expect(
      screen.getByText(/is this a recurring event\?/i)
    ).toBeInTheDocument();

    const radioButtons = screen.getAllByRole("radio");
    expect(radioButtons.length).toBe(2);
  });

  it("frequency dropdown is disabled when not recurring", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<RecurringEventConfig />} />
        </Routes>
      </MemoryRouter>
    );

    const selects = screen.getAllByRole("combobox");
    const frequencySelect = selects[0]; // First select is frequency
    expect(frequencySelect).toBeDisabled();
  });

  it("enables frequency dropdown when recurring is selected", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<RecurringEventConfig />} />
        </Routes>
      </MemoryRouter>
    );

    const yesRadio = screen.getByRole("radio", { name: /yes/i });
    await user.click(yesRadio);

    const selects = screen.getAllByRole("combobox");
    const frequencySelect = selects[0];
    expect(frequencySelect).not.toBeDisabled();
  });
  it("renders frequency options", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<RecurringEventConfig />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/every two weeks/i)).toBeInTheDocument();
    expect(screen.getByText(/monthly/i)).toBeInTheDocument();
    expect(screen.getByText(/every two months/i)).toBeInTheDocument();
  });

  it("renders occurrence count dropdown", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<RecurringEventConfig />} />
        </Routes>
      </MemoryRouter>
    );

    expect(
      screen.getByText(/how many times should this event recur/i)
    ).toBeInTheDocument();

    const countSelect = screen.getAllByRole("combobox")[1];
    expect(countSelect).toBeInTheDocument();
  });

  it("Next button is enabled for non-recurring events", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<RecurringEventConfig />} />
        </Routes>
      </MemoryRouter>
    );

    const nextButton = screen.getByRole("button", { name: /next/i });
    expect(nextButton).not.toBeDisabled();
  });

  it("Next button is disabled when recurring without frequency selected", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<RecurringEventConfig />} />
        </Routes>
      </MemoryRouter>
    );

    const yesRadio = screen.getByRole("radio", { name: /yes/i });
    await user.click(yesRadio);

    const nextButton = screen.getByRole("button", { name: /next/i });
    expect(nextButton).toBeDisabled();
  });

  it("navigates with programId from URL when Next clicked", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/?programId=prog123"]}>
        <Routes>
          <Route path="/" element={<RecurringEventConfig />} />
        </Routes>
      </MemoryRouter>
    );

    const nextButton = screen.getByRole("button", { name: /next/i });
    await user.click(nextButton);

    expect(mockNavigate).toHaveBeenCalledWith(
      "/dashboard/new-event?programId=prog123",
      expect.objectContaining({
        state: expect.objectContaining({
          isRecurring: false,
        }),
      })
    );
  });

  it("clears frequency and count when switching back to non-recurring", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<RecurringEventConfig />} />
        </Routes>
      </MemoryRouter>
    );

    // Select recurring
    const yesRadio = screen.getByRole("radio", { name: /yes/i });
    await user.click(yesRadio);

    // Select frequency
    const selects = screen.getAllByRole("combobox");
    const frequencySelect = selects[0];
    await user.selectOptions(frequencySelect, "monthly");

    // Switch back to non-recurring
    const noRadio = screen.getByRole("radio", { name: /no/i });
    await user.click(noRadio);

    // Frequency should be disabled again
    expect(frequencySelect).toBeDisabled();
  });
});
