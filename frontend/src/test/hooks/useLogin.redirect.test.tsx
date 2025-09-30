import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
// Mock navigate BEFORE importing hook
const navigateMock = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    useNavigate: () => navigateMock,
    MemoryRouter: actual.MemoryRouter,
    Routes: actual.Routes,
    Route: actual.Route,
    useLocation: actual.useLocation,
  };
});
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useLogin } from "../../hooks/useLogin";

// Mock auth context
vi.mock("../../hooks/useAuth", () => {
  return {
    useAuth: () => ({
      login: vi.fn().mockResolvedValue({ success: true }),
    }),
  };
});

// Mock notification system
vi.mock("../../contexts/NotificationModalContext", () => ({
  useToastReplacement: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  }),
}));

// Helper to render hook within router with initial URL
function setup(url: string) {
  const wrapper = ({ children }: any) => (
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/login" element={children} />
      </Routes>
    </MemoryRouter>
  );
  return renderHook(() => useLogin(), { wrapper });
}

describe("useLogin redirect param", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("navigates to redirect query param /dashboard/event/:id after success", async () => {
    const { result } = setup("/login?redirect=/dashboard/event/evt999");
    await act(async () => {
      await result.current.handleLogin({
        emailOrUsername: "user@example.com",
        password: "pass",
      } as any);
    });
    expect(navigateMock).toHaveBeenCalledWith("/dashboard/event/evt999", {
      replace: true,
    });
  });
});
