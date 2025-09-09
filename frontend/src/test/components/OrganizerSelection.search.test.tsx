import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import OrganizerSelection from "../../components/events/OrganizerSelection";
import { NotificationProvider } from "../../contexts/NotificationModalContext";
import { AuthProvider } from "../../contexts/AuthContext";

// Mock users hook to return only first 20 (simulate first page)
vi.mock("../../hooks/useUserData", () => ({
  useUserData: () => ({
    users: Array.from({ length: 20 }).map((_, i) => ({
      id: `u${i + 1}`,
      username: `user${i + 1}`,
      firstName: `First${i + 1}`,
      lastName: `Last${i + 1}`,
      email: `user${i + 1}@test.com`,
      role: (i % 2 === 0 ? "Leader" : "Participant") as any,
      isAtCloudLeader: "No",
      joinDate: "2024-01-01",
      gender: "male",
      isActive: true,
    })),
  }),
}));

// Mock searchService to return a user beyond page 1
vi.mock("../../services/api", async () => {
  const actual = await vi.importActual<typeof import("../../services/api")>(
    "../../services/api"
  );
  return {
    ...actual,
    searchService: {
      ...actual.searchService,
      searchUsers: vi.fn(async (q: string) => {
        // Simulate backend returning a matching Administrator that's not in first 20
        // And supports pagination info
        if (q.toLowerCase().includes("zoe")) {
          return {
            results: [
              {
                id: "u42",
                username: "zoe",
                firstName: "Zoe",
                lastName: "Admin",
                email: "zoe@example.com",
                role: "Administrator",
                gender: "female",
                isAtCloudLeader: false,
                createdAt: "2024-01-05T00:00:00.000Z",
                isActive: true,
              },
            ],
            pagination: { hasNext: false },
          } as any;
        }
        return { results: [], pagination: { hasNext: false } } as any;
      }),
    },
  };
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>
    <NotificationProvider>{children}</NotificationProvider>
  </AuthProvider>
);

describe("OrganizerSelection — search all authorized users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows search box and allows selecting a user beyond initial 20 via search", async () => {
    const mainOrganizer = {
      id: "u1",
      firstName: "Main",
      lastName: "Owner",
      systemAuthorizationLevel: "Administrator",
      gender: "male" as const,
      avatar: null,
      email: "main@example.com",
    };

    const onChange = vi.fn();

    render(
      <Wrapper>
        <OrganizerSelection
          mainOrganizer={mainOrganizer as any}
          selectedOrganizers={[]}
          onOrganizersChange={onChange}
        />
      </Wrapper>
    );

    // Open dropdown
    fireEvent.click(screen.getByText(/add co-organizer/i));

    // Type in the search box
    const input = await screen.findByPlaceholderText(/search name or email/i);
    fireEvent.change(input, { target: { value: "Zoe" } });

    // Wait for search result to appear and click it
    const result = await screen.findByText(/Zoe Admin/i);
    fireEvent.click(result);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
      const arg = onChange.mock.calls[0][0][0];
      expect(arg.email).toBe("zoe@example.com");
      expect(arg.systemAuthorizationLevel).toBe("Administrator");
    });
  });
});
