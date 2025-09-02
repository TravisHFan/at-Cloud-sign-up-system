import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Analytics from "../../pages/Analytics";

// Mock useAuth hook to return a Participant user
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    currentUser: { role: "Participant" },
    isAuthenticated: true,
    hasRole: () => true,
  }),
}));

// Spy on useAnalyticsData to verify it's called with enabled: false for Participants
const useAnalyticsDataMock = vi.fn().mockReturnValue({
  analytics: null,
  userAnalytics: null,
  eventAnalytics: null,
  engagementAnalytics: null,
  loading: false,
  error: null,
  refreshAnalytics: vi.fn(),
  exportData: vi.fn(),
});

vi.mock("../../hooks/useBackendIntegration", () => ({
  useAnalyticsData: (...args: any[]) => useAnalyticsDataMock(...args),
}));

// Mock toast replacement to ensure error would be visible if called
const toast = { info: vi.fn(), success: vi.fn(), error: vi.fn() };
vi.mock("../../contexts/NotificationModalContext", () => ({
  useToastReplacement: () => toast,
}));

describe("Analytics access (participant)", () => {
  beforeEach(() => {
    useAnalyticsDataMock.mockClear();
    toast.error.mockClear();
  });

  it("gates analytics fetch and does not show error toast for participants", async () => {
    render(<Analytics />);

    // Access Restricted page is shown
    expect(await screen.findByText(/Access Restricted/i)).toBeInTheDocument();

    // The hook is invoked once with options that include enabled: false
    expect(useAnalyticsDataMock).toHaveBeenCalled();
    const callArgs = useAnalyticsDataMock.mock.calls[0]?.[0] ?? {};
    expect(callArgs.enabled).toBe(false);
    expect(callArgs.suppressAuthErrors).toBe(true);

    // No error toast should be raised
    expect(toast.error).not.toHaveBeenCalled();
  });
});
