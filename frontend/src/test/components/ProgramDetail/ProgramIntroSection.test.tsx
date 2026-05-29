import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProgramIntroSection from "../../../components/ProgramDetail/ProgramIntroSection";

const navigateMock = vi.fn();
const useAuthMock = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

describe("ProgramIntroSection guest login redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ currentUser: null });
  });

  it("keeps guests on the shared program detail page after login", () => {
    render(
      <MemoryRouter
        initialEntries={["/dashboard/programs/program-123?ref=share"]}
      >
        <ProgramIntroSection
          programId="program-123"
          introduction="Program introduction"
          hasAccess={false}
          accessReason="not_purchased"
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /enroll now/i }));
    fireEvent.click(screen.getByRole("button", { name: /^login$/i }));

    expect(navigateMock).toHaveBeenCalledWith(
      "/login?redirect=%2Fdashboard%2Fprograms%2Fprogram-123%3Fref%3Dshare",
    );
  });
});
