/**
 * Promo Code Service
 *
 * Provides API interface for promo code operations.
 * Integrated with backend API (Todo #18 Complete).
 */

import { apiClient } from "./api";

/**
 * Promo Code Type Definition
 * This matches the shape expected by components
 */
export interface PromoCode {
  _id: string;
  code: string;
  type: "bundle_discount" | "staff_access" | "reward";
  applicableToType?: "program" | "event"; // Whether code is for programs or events (optional for backward compatibility)
  discountAmount?: number; // Dollar amount (e.g., 50 = $50 off)
  discountPercent?: number; // Percentage (e.g., 100 = 100% off for staff, 10-100% for reward)
  ownerId: string;
  allowedProgramIds?: string[];
  allowedProgramTitles?: string[];
  allowedEventIds?: string[]; // For event codes: specific events (empty = all events)
  allowedEventTitles?: string[]; // Titles of allowed events
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
    const response = await apiClient.getMyPromoCodes();
    return response.codes;
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
    // Get all user codes and filter on client side
    // Backend doesn't have a dedicated "available for program" endpoint
    const allCodes = await this.getMyPromoCodes();
    const now = new Date();

    return allCodes.filter((code) => {
      // Must be active and not used
      if (!code.isActive || code.isUsed) return false;

      // Must not be expired
      if (code.expiresAt && new Date(code.expiresAt) < now) return false;

      // Exclude codes explicitly marked for events only
      if (code.applicableToType === "event") return false;

      // If code has program restrictions, must include this program
      if (
        code.allowedProgramIds &&
        code.allowedProgramIds.length > 0 &&
        !code.allowedProgramIds.includes(programId)
      ) {
        return false;
      }

      return true;
    });
  }

  /**
   * Get available (active, unused, not expired) promo codes for a specific event
   * Used at event checkout to show user which codes they can apply
   *
   * @param eventId - ID of the event
   * @returns Promise<PromoCode[]>
   */
  async getUserAvailableCodesForEvent(eventId: string): Promise<PromoCode[]> {
    const allCodes = await this.getMyPromoCodes();
    const now = new Date();

    return allCodes.filter((code) => {
      // Must be active and not used
      if (!code.isActive || code.isUsed) return false;

      // Must not be expired
      if (code.expiresAt && new Date(code.expiresAt) < now) return false;

      // Exclude codes explicitly marked for programs only
      if (code.applicableToType === "program") return false;

      // If code has event restrictions, must include this event
      if (
        code.allowedEventIds &&
        code.allowedEventIds.length > 0 &&
        !code.allowedEventIds.includes(eventId)
      ) {
        return false;
      }

      return true;
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
    const result = await apiClient.validatePromoCode(code, programId);

    return {
      valid: result.valid,
      discount: result.discount,
      message: result.message,
      promoCode: result.promoCode,
    };
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
}

// Export singleton instance
export const promoCodeService = new PromoCodeService();
export default promoCodeService;
