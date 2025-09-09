import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import OrganizerSelection from "../../components/events/OrganizerSelection";
import { NotificationProvider } from "../../contexts/NotificationModalContext";
import { AuthProvider } from "../../contexts/AuthContext";

// Return empty first-page users from hook (simulate page-capped local list)
vi.mock("../../hooks/useUserData", () => ({
  useUserData: () => ({ users: [] }),
}));

// Mock userService.getUsers to simulate multiple paginated pages for each role
const getUsersMock = vi.fn();
vi.mock("../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../services/api")>(
    "../../services/api"
  );
  return {
    ...actual,
    userService: {
      ...actual.userService,
      getUsers: (...args: any[]) => getUsersMock(...args),
    },
  };
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>
    <NotificationProvider>{children}</NotificationProvider>
  </AuthProvider>
);

describe("OrganizerSelection — loads all authorized users without search", () => {
  it("loads multiple pages and renders authorized users list when dropdown opens", async () => {
    // Prepare mock pages: Leaders two pages, Admins one page
    const page1Leaders = Array.from({ length: 20 }).map((_, i) => ({
      id: `L${i + 1}`,
      username: `leader${i + 1}`,
      firstName: `Leader${i + 1}`,
      lastName: "User",
      email: `leader${i + 1}@x.com`,
      role: "Leader",
      isActive: true,
    }));
    const page2Leaders = [
      {
        id: "L21",
        username: "leader21",
        firstName: "Leader21",
        lastName: "User",
        email: "leader21@x.com",
        role: "Leader",
        isActive: true,
      },
    ];
    const page1Admins = [
      {
        id: "A1",
        username: "admin1",
        firstName: "Admin",
        lastName: "One",
        email: "admin1@x.com",
        role: "Administrator",
        isActive: true,
      },
    ];

    getUsersMock.mockImplementation(async (params: any) => {
      const role = params?.role;
      const page = params?.page || 1;
      if (role === "Leader") {
        if (page === 1)
          return { users: page1Leaders, pagination: { hasNext: true } };
        return { users: page2Leaders, pagination: { hasNext: false } };
      }
      if (role === "Administrator") {
        return { users: page1Admins, pagination: { hasNext: false } };
      }
      return { users: [], pagination: { hasNext: false } };
    });

    const mainOrganizer = {
      id: "owner1",
      firstName: "Owner",
      lastName: "Main",
      systemAuthorizationLevel: "Administrator",
      gender: "male" as const,
      avatar: null,
      email: "owner@x.com",
    };

    render(
      <Wrapper>
        <OrganizerSelection
          mainOrganizer={mainOrganizer as any}
          selectedOrganizers={[]}
          onOrganizersChange={() => {}}
        />
      </Wrapper>
    );

    // Open dropdown; without search it should start loading across pages
    fireEvent.click(screen.getByText(/add co-organizer/i));

    // Loading indicator appears then disappears
    expect(
      await screen.findByText(/loading authorized users/i)
    ).toBeInTheDocument();

    await waitFor(() => {
      // One of the users from page 2 should be visible (proof we traversed pages)
      expect(screen.getByText(/Leader21 User/i)).toBeInTheDocument();
      // And an Administrator should be visible too
      expect(screen.getByText(/Admin One/i)).toBeInTheDocument();
    });
  });
});
