/**
 * Mock Service Helpers
 *
 * Provides comprehensive mock implementations for all API services
 * to prevent "missing export" errors in tests.
 */

import { vi } from "vitest";

/**
 * Creates a complete mock for programService with all required methods
 */
export const createMockProgramService = (
  overrides?: Record<string, unknown>
) => ({
  getById: vi.fn(async () => null),
  listPrograms: vi.fn(async () => []),
  listEvents: vi.fn(async () => []),
  listProgramEvents: vi.fn(async () => []),
  listProgramEventsPaged: vi.fn(async () => ({
    items: [],
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })),
  getParticipants: vi.fn(async () => ({
    mentees: [],
    mentors: [],
    classReps: [],
  })),
  create: vi.fn(async () => ({})),
  update: vi.fn(async () => ({})),
  delete: vi.fn(async () => ({})),
  deleteProgram: vi.fn(async () => ({ success: true })),
  ...overrides,
});

/**
 * Creates a complete mock for purchaseService with all required methods
 */
export const createMockPurchaseService = (
  overrides?: Record<string, unknown>
) => ({
  checkProgramAccess: vi.fn(async () => ({ hasAccess: false })),
  createCheckoutSession: vi.fn(async () => ({
    url: "https://checkout.stripe.com/test",
  })),
  getMyPurchases: vi.fn(async () => []),
  ...overrides,
});

/**
 * Creates a complete mock for eventService with all required methods
 */
export const createMockEventService = (
  overrides?: Record<string, unknown>
) => ({
  getById: vi.fn(async () => null),
  list: vi.fn(async () => []),
  create: vi.fn(async () => ({})),
  update: vi.fn(async () => ({})),
  delete: vi.fn(async () => ({})),
  register: vi.fn(async () => ({})),
  unregister: vi.fn(async () => ({})),
  ...overrides,
});

/**
 * Creates a complete mock for promoCodeService with all required methods
 */
export const createMockPromoCodeService = (
  overrides?: Record<string, unknown>
) => ({
  getMyPromoCodes: vi.fn(async () => []),
  getUserAvailableCodesForProgram: vi.fn(async () => []),
  validateCode: vi.fn(async () => ({ valid: false })),
  ...overrides,
});

/**
 * Creates a complete mock for roleTemplateService with all required methods
 */
export const createMockRoleTemplateService = (
  overrides?: Record<string, unknown>
) => ({
  getRolesTemplatesByEventType: vi.fn(async () => [] as unknown[]),
  getRolesTemplateById: vi.fn(async () => null),
  getAllRolesTemplates: vi.fn(async () => ({})),
  getAllTemplates: vi.fn(async () => []),
  getTemplateById: vi.fn(async () => null),
  getById: vi.fn(async () => null),
  create: vi.fn(async () => ({})),
  update: vi.fn(async () => ({})),
  delete: vi.fn(async () => ({})),
  deleteTemplate: vi.fn(async () => ({})),
  list: vi.fn(async () => []),
  ...overrides,
});

/**
 * Creates a complete mock for userService with all required methods
 */
export const createMockUserService = (overrides?: Record<string, unknown>) => ({
  getById: vi.fn(async () => null),
  list: vi.fn(async () => []),
  update: vi.fn(async () => ({})),
  delete: vi.fn(async () => ({})),
  getCurrentUser: vi.fn(async () => null),
  ...overrides,
});

/**
 * Creates a complete mock for authService with all required methods
 */
export const createMockAuthService = (overrides?: Record<string, unknown>) => ({
  login: vi.fn(async () => ({ user: null, token: "" })),
  logout: vi.fn(async () => ({})),
  register: vi.fn(async () => ({ user: null, token: "" })),
  getProfile: vi.fn(async () => null),
  updateProfile: vi.fn(async () => ({})),
  ...overrides,
});

/**
 * Creates a complete mock for apiClient with all required methods
 */
export const createMockApiClient = (overrides?: Record<string, unknown>) => ({
  get: vi.fn(async () => ({ data: null })),
  post: vi.fn(async () => ({ data: null })),
  put: vi.fn(async () => ({ data: null })),
  delete: vi.fn(async () => ({ data: null })),
  patch: vi.fn(async () => ({ data: null })),
  ...overrides,
});

/**
 * Creates a complete mock for all API services
 * This is the comprehensive mock that should prevent most "missing export" errors
 */
export const createMockApiServices = (overrides?: {
  programService?: Record<string, unknown>;
  purchaseService?: Record<string, unknown>;
  eventService?: Record<string, unknown>;
  promoCodeService?: Record<string, unknown>;
  roleTemplateService?: Record<string, unknown>;
  userService?: Record<string, unknown>;
  authService?: Record<string, unknown>;
  apiClient?: Record<string, unknown>;
}) => ({
  programService: createMockProgramService(overrides?.programService),
  purchaseService: createMockPurchaseService(overrides?.purchaseService),
  eventService: createMockEventService(overrides?.eventService),
  promoCodeService: createMockPromoCodeService(overrides?.promoCodeService),
  roleTemplateService: createMockRoleTemplateService(
    overrides?.roleTemplateService
  ),
  userService: createMockUserService(overrides?.userService),
  authService: createMockAuthService(overrides?.authService),
  apiClient: createMockApiClient(overrides?.apiClient),
});
