import { vi } from "vitest";

/**
 * Installs mocks for both hooks and context based auth imports.
 * Some components import from ../hooks/useAuth while others import from ../contexts/AuthContext.
 * This ensures a consistent stub without repeating mock blocks in each test file.
 */
export function mockAuthContext(
  overrides: Partial<ReturnType<typeof baseAuth>> = {}
) {
  const auth = { ...baseAuth(), ...overrides };
  // Use doMock (runtime) so closure over auth is preserved
  vi.doMock("../../hooks/useAuth", () => ({
    useAuth: () => auth,
  }));
  vi.doMock("../../contexts/AuthContext", () => ({
    useAuth: () => auth,
  }));
  return auth;
}

function baseAuth() {
  return {
    currentUser: { id: "u-test", role: "Administrator" as string },
    hasRole: () => true,
    isAuthenticated: true,
    isLoading: false,
  };
}

export type MockAuth = ReturnType<typeof baseAuth>;
