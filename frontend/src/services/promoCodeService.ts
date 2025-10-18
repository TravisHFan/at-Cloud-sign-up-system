/**
 * Promo Code Service
 *
 * Provides API interface for promo code operations.
 * Currently uses mock data for development. Will be replaced with
 * real API calls in Todo #18 (Backend Integration Phase).
 */

import {
  getMockUserPromoCodes,
  getMockAvailableCodesForProgram,
  validateMockPromoCode,
  type MockPromoCode,
} from "../mocks/promoCodes";

/**
 * Promo Code Type Definition
 * This matches the shape expected by components
 */
export interface PromoCode {
  _id: string;
  code: string;
  type: "bundle_discount" | "staff_access";
  discountAmount?: number; // Dollar amount (e.g., 50 = $50 off)
  discountPercent?: number; // Percentage (e.g., 100 = 100% off)
  ownerId: string;
  allowedProgramIds?: string[];
  isActive: boolean;
  isUsed: boolean;
  expiresAt?: string; // ISO date string
  usedAt?: string;
  usedForProgramId?: string;
  usedForProgramTitle?: string;
  createdAt: string;
  createdBy: string;
}

/**
 * Validation Result
 */
export interface PromoCodeValidationResult {
  valid: boolean;
  discount?: {
    type: "amount" | "percent";
    value: number;
  };
  promoCode?: PromoCode;
  message: string;
}

/**
 * Service Class
 */
class PromoCodeService {
  /**
   * Get all promo codes for the current user
   * Returns codes in all states (active, used, expired)
   *
   * @returns Promise<PromoCode[]>
   */
  async getMyPromoCodes(): Promise<PromoCode[]> {
    // TODO [Todo #18]: Replace with real API call
    // return await api.get('/api/promo-codes/my');

    // Mock implementation - simulates API delay
    return new Promise((resolve) => {
      setTimeout(async () => {
        const mockCodes = await getMockUserPromoCodes();
        const codes: PromoCode[] = mockCodes.map(this.convertMockToPromoCode);
        resolve(codes);
      }, 300); // Simulate network delay
    });
  }

  /**
   * Get available (active, unused, not expired) promo codes for a specific program
   * Used at checkout to show user which codes they can apply
   *
   * @param programId - ID of the program
   * @returns Promise<PromoCode[]>
   */
  async getUserAvailableCodesForProgram(
    programId: string
  ): Promise<PromoCode[]> {
    // TODO [Todo #18]: Replace with real API call
    // return await api.get(`/api/promo-codes/available/${programId}`);

    // Mock implementation
    return new Promise((resolve) => {
      setTimeout(async () => {
        const mockCodes = await getMockAvailableCodesForProgram(programId);
        const codes: PromoCode[] = mockCodes.map(this.convertMockToPromoCode);
        resolve(codes);
      }, 300);
    });
  }

  /**
   * Validate a promo code for a specific program
   * Checks if code exists, is active, not used, not expired, and allowed for program
   *
   * @param code - The promo code string to validate
   * @param programId - ID of the program
   * @returns Promise<PromoCodeValidationResult>
   */
  async validatePromoCode(
    code: string,
    programId: string
  ): Promise<PromoCodeValidationResult> {
    // TODO [Todo #18]: Replace with real API call
    // return await api.post('/api/promo-codes/validate', { code, programId });

    // Mock implementation
    return new Promise((resolve) => {
      setTimeout(async () => {
        const result = await validateMockPromoCode(code, programId);

        // Convert MockPromoCode to PromoCode if present
        const validationResult: PromoCodeValidationResult = {
          valid: result.valid,
          discount: result.discount,
          message: result.message || "Validation complete",
          promoCode: result.promoCode
            ? this.convertMockToPromoCode(result.promoCode)
            : undefined,
        };

        resolve(validationResult);
      }, 500); // Simulate validation delay
    });
  }

  /**
   * Get promo codes filtered by status
   * Used by MyPromoCodes page for tab filtering
   *
   * @param status - Filter: 'all', 'active', 'used', 'expired'
   * @returns Promise<PromoCode[]>
   */
  async getMyPromoCodesByStatus(
    status: "all" | "active" | "used" | "expired"
  ): Promise<PromoCode[]> {
    // TODO [Todo #18]: Replace with real API call
    // return await api.get(`/api/promo-codes/my?status=${status}`);

    // Mock implementation - filter locally
    return new Promise((resolve) => {
      setTimeout(async () => {
        const allCodes = await this.getMyPromoCodes();
        const now = new Date();

        let filtered: PromoCode[];
        switch (status) {
          case "active":
            filtered = allCodes.filter((code) => {
              const notUsed = !code.isUsed;
              const notExpired =
                !code.expiresAt || new Date(code.expiresAt) >= now;
              return notUsed && notExpired;
            });
            break;

          case "used":
            filtered = allCodes.filter((code) => code.isUsed);
            break;

          case "expired":
            filtered = allCodes.filter((code) => {
              const notUsed = !code.isUsed;
              const isExpired =
                code.expiresAt && new Date(code.expiresAt) < now;
              return notUsed && isExpired;
            });
            break;

          case "all":
          default:
            filtered = allCodes;
        }

        resolve(filtered);
      }, 200);
    });
  }

  /**
   * Helper: Convert MockPromoCode to PromoCode
   * Ensures type compatibility between mock data and component interfaces
   */
  private convertMockToPromoCode(mockCode: MockPromoCode): PromoCode {
    return {
      _id: mockCode._id,
      code: mockCode.code,
      type: mockCode.type,
      discountAmount: mockCode.discountAmount,
      discountPercent: mockCode.discountPercent,
      ownerId: mockCode.ownerId,
      allowedProgramIds: mockCode.allowedProgramIds,
      isActive: mockCode.isActive,
      isUsed: mockCode.isUsed,
      expiresAt: mockCode.expiresAt,
      usedAt: mockCode.usedAt,
      usedForProgramId: mockCode.usedForProgramId,
      usedForProgramTitle: mockCode.usedForProgramTitle,
      createdAt: mockCode.createdAt,
      createdBy: mockCode.createdBy,
    };
  }
}

// Export singleton instance
export const promoCodeService = new PromoCodeService();
export default promoCodeService;
