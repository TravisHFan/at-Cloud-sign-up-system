/**
 * Mock Promo Code Data for Development
 *
 * This file provides realistic mock data for promo codes to enable
 * frontend development without backend dependency.
 */

export interface MockPromoCode {
  _id: string;
  code: string;
  type: "bundle_discount" | "staff_access";
  discountAmount?: number; // Dollar amount for bundle codes (e.g., 50 = $50 off)
  discountPercent?: number; // Percentage for staff codes (100 = 100% off)
  ownerId: string;
  allowedProgramIds?: string[]; // Empty = all programs, specific IDs = restricted
  isActive: boolean;
  isUsed: boolean;
  expiresAt?: string; // ISO date string
  usedAt?: string;
  usedForProgramId?: string;
  usedForProgramTitle?: string;
  createdAt: string;
  createdBy: string;
}

// Current mock user ID (should match logged-in user in real app)
const MOCK_USER_ID = "mock-user-123";

/**
 * Mock Promo Codes for Various Test Scenarios
 */
export const mockPromoCodes: MockPromoCode[] = [
  // Active Bundle Discount - $50 off
  {
    _id: "promo-001",
    code: "X8K9P2L4",
    type: "bundle_discount",
    discountAmount: 50,
    ownerId: MOCK_USER_ID,
    isActive: true,
    isUsed: false,
    expiresAt: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(), // 28 days from now
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    createdBy: "system",
  },

  // Active Bundle Discount - $30 off (smaller amount)
  {
    _id: "promo-002",
    code: "A3B7C9D2",
    type: "bundle_discount",
    discountAmount: 30,
    ownerId: MOCK_USER_ID,
    isActive: true,
    isUsed: false,
    expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days from now
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days ago
    createdBy: "system",
  },

  // Active Staff Access Code - 100% off, no expiry
  {
    _id: "promo-003",
    code: "STAFF2025",
    type: "staff_access",
    discountPercent: 100,
    ownerId: MOCK_USER_ID,
    allowedProgramIds: [], // Empty = all programs
    isActive: true,
    isUsed: false,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    createdBy: "admin-user-456",
  },

  // Used Bundle Discount
  {
    _id: "promo-004",
    code: "K2M5N8P1",
    type: "bundle_discount",
    discountAmount: 50,
    ownerId: MOCK_USER_ID,
    isActive: true,
    isUsed: true,
    expiresAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
    usedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // Used 3 days ago
    usedForProgramId: "program-123",
    usedForProgramTitle: "ECW Spring 2025",
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: "system",
  },

  // Expired Bundle Discount
  {
    _id: "promo-005",
    code: "Z1Y2X3W4",
    type: "bundle_discount",
    discountAmount: 50,
    ownerId: MOCK_USER_ID,
    isActive: true,
    isUsed: false,
    expiresAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // Expired 5 days ago
    createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: "system",
  },

  // Used Staff Access Code
  {
    _id: "promo-006",
    code: "VOLUNT01",
    type: "staff_access",
    discountPercent: 100,
    ownerId: MOCK_USER_ID,
    allowedProgramIds: [],
    isActive: true,
    isUsed: true,
    usedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    usedForProgramId: "program-789",
    usedForProgramTitle: "EMBA Mentor Circles 2025",
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: "admin-user-456",
  },

  // Active Staff Code with Program Restriction
  {
    _id: "promo-007",
    code: "SPEAKER2025",
    type: "staff_access",
    discountPercent: 100,
    ownerId: MOCK_USER_ID,
    allowedProgramIds: ["program-specific-123"], // Restricted to one program
    isActive: true,
    isUsed: false,
    expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: "admin-user-456",
  },
];

/**
 * Mock function: Get all promo codes for current user
 */
export const getMockUserPromoCodes = (): Promise<MockPromoCode[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockPromoCodes.filter((code) => code.ownerId === MOCK_USER_ID));
    }, 300); // Simulate network delay
  });
};

/**
 * Mock function: Get active promo codes available for a specific program
 */
export const getMockAvailableCodesForProgram = (
  programId: string
): Promise<MockPromoCode[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const now = new Date();
      const available = mockPromoCodes.filter((code) => {
        // Must belong to user
        if (code.ownerId !== MOCK_USER_ID) return false;

        // Must be active and not used
        if (!code.isActive || code.isUsed) return false;

        // Must not be expired
        if (code.expiresAt && new Date(code.expiresAt) < now) return false;

        // If staff code has program restrictions, check them
        if (
          code.type === "staff_access" &&
          code.allowedProgramIds &&
          code.allowedProgramIds.length > 0
        ) {
          return code.allowedProgramIds.includes(programId);
        }

        // Bundle codes are always available for any program
        return true;
      });

      resolve(available);
    }, 300);
  });
};

/**
 * Mock function: Validate a promo code for a specific program
 */
export const validateMockPromoCode = (
  code: string,
  programId: string
): Promise<{
  valid: boolean;
  discount?: { type: "amount" | "percent"; value: number };
  message?: string;
  promoCode?: MockPromoCode;
}> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const promoCode = mockPromoCodes.find(
        (p) => p.code.toUpperCase() === code.toUpperCase()
      );

      // Code doesn't exist
      if (!promoCode) {
        resolve({
          valid: false,
          message: "Invalid promo code. Please check and try again.",
        });
        return;
      }

      // Code doesn't belong to user
      if (promoCode.ownerId !== MOCK_USER_ID) {
        resolve({
          valid: false,
          message: "This promo code does not belong to you.",
        });
        return;
      }

      // Code already used
      if (promoCode.isUsed) {
        resolve({
          valid: false,
          message: `This code was already used on ${promoCode.usedForProgramTitle}.`,
        });
        return;
      }

      // Code expired
      if (promoCode.expiresAt && new Date(promoCode.expiresAt) < new Date()) {
        resolve({
          valid: false,
          message: "This promo code has expired.",
        });
        return;
      }

      // Staff code with program restrictions
      if (
        promoCode.type === "staff_access" &&
        promoCode.allowedProgramIds &&
        promoCode.allowedProgramIds.length > 0 &&
        !promoCode.allowedProgramIds.includes(programId)
      ) {
        resolve({
          valid: false,
          message: "This code cannot be used for this program.",
        });
        return;
      }

      // Valid code!
      const discount =
        promoCode.type === "bundle_discount"
          ? { type: "amount" as const, value: promoCode.discountAmount || 0 }
          : { type: "percent" as const, value: promoCode.discountPercent || 0 };

      resolve({
        valid: true,
        discount,
        promoCode,
        message: `Code applied! You get ${
          discount.type === "amount"
            ? `$${discount.value}`
            : `${discount.value}%`
        } off.`,
      });
    }, 500); // Simulate validation delay
  });
};

/**
 * Mock function: Filter promo codes by status
 */
export const filterMockPromoCodesByStatus = (
  codes: MockPromoCode[],
  status: "all" | "active" | "used" | "expired"
): MockPromoCode[] => {
  const now = new Date();

  switch (status) {
    case "active":
      return codes.filter((code) => {
        const notUsed = !code.isUsed;
        const notExpired = !code.expiresAt || new Date(code.expiresAt) >= now;
        return notUsed && notExpired;
      });

    case "used":
      return codes.filter((code) => code.isUsed);

    case "expired":
      return codes.filter((code) => {
        const notUsed = !code.isUsed;
        const isExpired = code.expiresAt && new Date(code.expiresAt) < now;
        return notUsed && isExpired;
      });

    case "all":
    default:
      return codes;
  }
};

/**
 * Mock function: Calculate discount amount
 */
export const calculateMockDiscount = (
  originalPrice: number,
  promoCode: MockPromoCode
): number => {
  if (promoCode.type === "bundle_discount") {
    // Dollar amount discount
    return Math.min(promoCode.discountAmount || 0, originalPrice);
  } else {
    // Percentage discount (100% off)
    return (originalPrice * (promoCode.discountPercent || 0)) / 100;
  }
};

/**
 * Mock function: Get discount display text
 */
export const getMockDiscountDisplay = (promoCode: MockPromoCode): string => {
  if (promoCode.type === "bundle_discount") {
    return `$${promoCode.discountAmount} OFF`;
  } else {
    return `${promoCode.discountPercent}% OFF`;
  }
};

/**
 * Mock function: Get days until expiry
 */
export const getMockDaysUntilExpiry = (expiresAt?: string): number | null => {
  if (!expiresAt) return null;

  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return diffDays;
};

/**
 * Mock function: Format expiry text for display
 */
export const formatMockExpiryText = (expiresAt?: string): string => {
  if (!expiresAt) return "No expiration";

  const days = getMockDaysUntilExpiry(expiresAt);
  if (days === null) return "No expiration";
  if (days < 0) return "Expired";
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  if (days < 7) return `Expires in ${days} days`;
  if (days < 30) return `Expires in ${Math.ceil(days / 7)} weeks`;

  const expiryDate = new Date(expiresAt);
  return `Expires: ${expiryDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
};

export default {
  mockPromoCodes,
  getMockUserPromoCodes,
  getMockAvailableCodesForProgram,
  validateMockPromoCode,
  filterMockPromoCodesByStatus,
  calculateMockDiscount,
  getMockDiscountDisplay,
  getMockDaysUntilExpiry,
  formatMockExpiryText,
};
