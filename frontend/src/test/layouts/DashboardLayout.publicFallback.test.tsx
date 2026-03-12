import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

/**
 * Tests for guest-allowed route access in DashboardLayout.
 * Unauthenticated users can access specific routes as guests;
 * other dashboard routes redirect to /login.
 */
describe("DashboardLayout - Guest Allowed Routes", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  const mockUnauthenticated = () => {
    vi.doMock("../../hooks/useAuth", async () => ({
      __esModule: true,
      useAuth: () => ({ isLoading: false, currentUser: null }),
    }));
    vi.doMock("../../contexts/AuthContext", async () => ({
      __esModule: true,
      useAuth: () => ({
        currentUser: null,
        isAuthenticated: false,
        isLoading: false,
      }),
    }));
    // Stub sub-components so only routing logic is tested
    vi.doMock("../../layouts/dashboard/Header", async () => ({
      __esModule: true,
      default: () => <header data-testid="header" />,
    }));
    vi.doMock("../../layouts/dashboard/Sidebar", async () => ({
      __esModule: true,
      default: () => <aside data-testid="sidebar" />,
    }));
    vi.doMock("../../components/common/Footer", async () => ({
      __esModule: true,
      default: () => <footer data-testid="footer" />,
    }));
  };

  it("allows guest access to /dashboard/programs/:id", async () => {
    mockUnauthenticated();
    const { default: Layout } = await import("../../layouts/DashboardLayout");
    const programId = "507f1f77bcf86cd799439011";

    render(
      <MemoryRouter initialEntries={[`/dashboard/programs/${programId}`]}>
        <Routes>
          <Route path="/dashboard/*" element={<Layout />}>
            <Route
              path="programs/:id"
              element={<div data-testid="program-detail">Program Detail</div>}
            />
          </Route>
          <Route
            path="/login"
            element={<div data-testid="login">Login Page</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("program-detail")).toBeInTheDocument();
    expect(screen.queryByTestId("login")).not.toBeInTheDocument();
  });

  it("allows guest access to /dashboard/welcome", async () => {
    mockUnauthenticated();
    const { default: Layout } = await import("../../layouts/DashboardLayout");

    render(
      <MemoryRouter initialEntries={["/dashboard/welcome"]}>
        <Routes>
          <Route path="/dashboard/*" element={<Layout />}>
            <Route
              path="welcome"
              element={<div data-testid="welcome">Welcome</div>}
            />
          </Route>
          <Route
            path="/login"
            element={<div data-testid="login">Login Page</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("welcome")).toBeInTheDocument();
    expect(screen.queryByTestId("login")).not.toBeInTheDocument();
  });

  it("redirects guest from non-allowed routes to /login", async () => {
    mockUnauthenticated();
    const { default: Layout } = await import("../../layouts/DashboardLayout");

    render(
      <MemoryRouter initialEntries={["/dashboard/management"]}>
        <Routes>
          <Route path="/dashboard/*" element={<Layout />}>
            <Route
              path="management"
              element={<div data-testid="management">Management</div>}
            />
          </Route>
          <Route
            path="/login"
            element={<div data-testid="login">Login Page</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("login")).toBeInTheDocument();
    expect(screen.queryByTestId("management")).not.toBeInTheDocument();
  });

  it("does not redirect authenticated users from any route", async () => {
    vi.doMock("../../hooks/useAuth", async () => ({
      __esModule: true,
      useAuth: () => ({
        isLoading: false,
        currentUser: {
          id: "u1",
          username: "testuser",
          firstName: "Test",
          lastName: "User",
          email: "test@example.com",
          role: "Member",
          gender: "male",
          avatar: null,
        },
      }),
    }));

    vi.doMock("../../contexts/AuthContext", async () => ({
      __esModule: true,
      useAuth: () => ({
        currentUser: {
          id: "u1",
          username: "testuser",
          firstName: "Test",
          lastName: "User",
          email: "test@example.com",
          role: "Member",
          gender: "male",
          avatar: null,
        },
        isAuthenticated: true,
        isLoading: false,
      }),
    }));

    vi.doMock("../../layouts/dashboard/Header", async () => ({
      __esModule: true,
      default: () => <header data-testid="header" />,
    }));
    vi.doMock("../../layouts/dashboard/Sidebar", async () => ({
      __esModule: true,
      default: () => <aside data-testid="sidebar" />,
    }));
    vi.doMock("../../components/common/Footer", async () => ({
      __esModule: true,
      default: () => <footer data-testid="footer" />,
    }));

    const { default: Layout } = await import("../../layouts/DashboardLayout");
    const programId = "507f1f77bcf86cd799439011";

    render(
      <MemoryRouter initialEntries={[`/dashboard/programs/${programId}`]}>
        <Routes>
          <Route path="/dashboard/*" element={<Layout />}>
            <Route
              path="programs/:id"
              element={<div data-testid="program-detail">Program Detail</div>}
            />
          </Route>
          <Route
            path="/login"
            element={<div data-testid="login">Login Page</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("program-detail")).toBeInTheDocument();
    expect(screen.queryByTestId("login")).not.toBeInTheDocument();
  });
});
