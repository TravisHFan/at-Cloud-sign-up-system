import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import EventRoleSignup from "../../components/events/EventRoleSignup";

// Provide a lightweight AuthContext stub so components that call useAuth don't throw
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ currentUser: { id: "u1", role: "Participant" } }),
  AuthProvider: ({ children }: any) => children,
}));

describe("Role description newline rendering", () => {
  it("applies whitespace-pre-line so \n shows as line breaks", () => {
    const role = {
      id: "r1",
      name: "Spiritual Adviser",
      description: "• One\n• Two\n• Three",
      maxParticipants: 1,
    };

    render(
      <MemoryRouter>
        <EventRoleSignup
          role={{ ...role, currentSignups: [] } as any}
          onSignup={() => {}}
          onCancel={() => {}}
          currentUserId="u1"
          currentUserRole="Participant"
          isUserSignedUpForThisRole={false}
          hasReachedMaxRoles={false}
          maxRolesForUser={2}
          isRoleAllowedForUser={true}
          guestCount={0}
        />
      </MemoryRouter>
    );

    const para = screen.getByText("• One", { exact: false });
    expect(para).toBeInTheDocument();
    expect((para as HTMLElement).className).toContain("whitespace-pre-line");
  });
});
