import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  MemoryRouter,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from "react-router-dom";
import ProtectedRoute from "../../components/common/ProtectedRoute";

// We'll mock useAuth so we can control authentication transitions.
const useAuthMock = vi.fn();
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

// Lightweight stand-in for the real login page that uses the updated redirect logic.
// It simulates a successful login when the button is clicked by changing the mock return value
// and then triggering a re-render via navigate to force ProtectedRoute to run again.
function MockLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div>
      <div>Mock Login Page</div>
      <button
        onClick={() => {
          // Simulate auth state update
          useAuthMock.mockReturnValue({
            currentUser: { id: "u1", role: "Participant" },
            isLoading: false,
          });
          // Navigate to the original target (the real app's login hook handles this).
          const from = (location.state as any)?.from;
          const target = from?.pathname || "/dashboard";
          navigate(target, { replace: true });
        }}
      >
        Complete Login
      </button>
    </div>
  );
}

describe("Post-login redirect to originally requested protected route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem("authToken");
    // Start unauthenticated for each test.
    useAuthMock.mockReturnValue({ currentUser: null, isLoading: false });
  });

  it("redirects to originally requested protected event detail after login", async () => {
    const originalPath = "/dashboard/event/evt123";

    render(
      <MemoryRouter initialEntries={[originalPath]}>
        <Routes>
          <Route
            path="/dashboard/event/:id"
            element={
              <ProtectedRoute>
                <div>Event Detail Page</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<MockLogin />} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    // Initially redirected to login
    expect(await screen.findByText(/Mock Login Page/i)).toBeInTheDocument();

    // Perform the simulated login
    fireEvent.click(screen.getByRole("button", { name: /Complete Login/i }));

    // Should land on the originally requested event detail page
    expect(await screen.findByText(/Event Detail Page/i)).toBeInTheDocument();
  });
});
