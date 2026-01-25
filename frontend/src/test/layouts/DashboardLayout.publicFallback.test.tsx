import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

/**
 * Tests for the public fallback redirect feature in DashboardLayout.
 * When unauthenticated users access /dashboard/programs/:id,
 * they should be redirected to /pr/:id instead of the login page.
 */
describe("DashboardLayout - Public Fallback Redirect", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("redirects unauthenticated users from /dashboard/programs/:id to /pr/:id", async () => {
    // Mock auth to return unauthenticated state
    vi.doMock("../../hooks/useAuth", async () => ({
      __esModule: true,
      useAuth: () => ({
        isLoading: false,
        currentUser: null,
      }),
    }));

    vi.doMock("../../contexts/AuthContext", async () => ({
      __esModule: true,
      useAuth: () => ({
        currentUser: null,
        isAuthenticated: false,
        isLoading: false,
      }),
    }));

    const { default: Layout } = await import("../../layouts/DashboardLayout");

    const programId = "507f1f77bcf86cd799439011";

    render(
      <MemoryRouter initialEntries={[`/dashboard/programs/${programId}`]}>
        <Routes>
          <Route path="/dashboard/*" element={<Layout />}>
            <Route path="programs/:id" element={<div>Program Detail</div>} />
          </Route>
          <Route
            path="/pr/:id"
            element={
              <div data-testid="public-program">Public Program Page</div>
            }
          />
          <Route
            path="/login"
            element={<div data-testid="login">Login Page</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    // Should redirect to public program page, NOT login
    expect(screen.getByTestId("public-program")).toBeInTheDocument();
    expect(screen.queryByTestId("login")).not.toBeInTheDocument();
  });

  it("redirects unauthenticated users from other dashboard routes to login", async () => {
    vi.doMock("../../hooks/useAuth", async () => ({
      __esModule: true,
      useAuth: () => ({
        isLoading: false,
        currentUser: null,
      }),
    }));

    vi.doMock("../../contexts/AuthContext", async () => ({
      __esModule: true,
      useAuth: () => ({
        currentUser: null,
        isAuthenticated: false,
        isLoading: false,
      }),
    }));

    const { default: Layout } = await import("../../layouts/DashboardLayout");

    render(
      <MemoryRouter initialEntries={["/dashboard/upcoming"]}>
        <Routes>
          <Route path="/dashboard/*" element={<Layout />}>
            <Route path="upcoming" element={<div>Upcoming Events</div>} />
          </Route>
          <Route
            path="/login"
            element={<div data-testid="login">Login Page</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    // Should redirect to login for non-program routes
    expect(screen.getByTestId("login")).toBeInTheDocument();
  });

  it("does not redirect authenticated users accessing program detail", async () => {
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

    // Mock layout dependencies
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
            path="/pr/:id"
            element={
              <div data-testid="public-program">Public Program Page</div>
            }
          />
          <Route
            path="/login"
            element={<div data-testid="login">Login Page</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    // Authenticated users should see the program detail page
    expect(screen.getByTestId("program-detail")).toBeInTheDocument();
    expect(screen.queryByTestId("public-program")).not.toBeInTheDocument();
    expect(screen.queryByTestId("login")).not.toBeInTheDocument();
  });

  it("does not redirect to public for non-MongoDB ObjectId paths", async () => {
    vi.doMock("../../hooks/useAuth", async () => ({
      __esModule: true,
      useAuth: () => ({
        isLoading: false,
        currentUser: null,
      }),
    }));

    vi.doMock("../../contexts/AuthContext", async () => ({
      __esModule: true,
      useAuth: () => ({
        currentUser: null,
        isAuthenticated: false,
        isLoading: false,
      }),
    }));

    const { default: Layout } = await import("../../layouts/DashboardLayout");

    // Invalid ObjectId (too short)
    render(
      <MemoryRouter initialEntries={["/dashboard/programs/invalid-id"]}>
        <Routes>
          <Route path="/dashboard/*" element={<Layout />}>
            <Route path="programs/:id" element={<div>Program Detail</div>} />
          </Route>
          <Route
            path="/pr/:id"
            element={
              <div data-testid="public-program">Public Program Page</div>
            }
          />
          <Route
            path="/login"
            element={<div data-testid="login">Login Page</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    // Should redirect to login for invalid program IDs
    expect(screen.getByTestId("login")).toBeInTheDocument();
    expect(screen.queryByTestId("public-program")).not.toBeInTheDocument();
  });
});
