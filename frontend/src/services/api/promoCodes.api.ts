import { BaseApiClient } from "./common";

/**
 * Promo Codes API Service
 * Handles promo code operations for users and admin management
 */
class PromoCodesApiClient extends BaseApiClient {
  // ========== User Promo Code Operations ==========

  async getMyPromoCodes(): Promise<{
    codes: Array<{
      _id: string;
      code: string;
      type: "bundle_discount" | "staff_access";
      discountAmount?: number;
      discountPercent?: number;
      ownerId: string;
      allowedProgramIds?: string[];
      isActive: boolean;
      isUsed: boolean;
      expiresAt?: string;
      usedAt?: string;
      usedForProgramId?: string;
      usedForProgramTitle?: string;
      createdAt: string;
      createdBy: string;
    }>;
  }> {
    const res = await this.request<{
      codes: Array<{
        _id: string;
        code: string;
        type: "bundle_discount" | "staff_access";
        discountAmount?: number;
        discountPercent?: number;
        ownerId: string;
        allowedProgramIds?: string[];
        isActive: boolean;
        isUsed: boolean;
        expiresAt?: string;
        usedAt?: string;
        usedForProgramId?: string;
        usedForProgramTitle?: string;
        createdAt: string;
        createdBy: string;
      }>;
    }>(`/promo-codes/my-codes`, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    });
    // Backend returns {success: true, codes: [...]} directly, not wrapped in data
    type CodesResponse = {
      codes?: Array<{
        _id: string;
        code: string;
        type: "bundle_discount" | "staff_access";
        discountAmount?: number;
        discountPercent?: number;
        ownerId: string;
        allowedProgramIds?: string[];
        isActive: boolean;
        isUsed: boolean;
        expiresAt?: string;
        usedAt?: string;
        usedForProgramId?: string;
        usedForProgramTitle?: string;
        createdAt: string;
        createdBy: string;
      }>;
    };
    return {
      codes: (res as CodesResponse).codes || [],
    };
  }

  /**
   * Validate a promo code for a specific program
   * @param code - Promo code string to validate
   * @param programId - ID of the program
   * @returns Validation result with discount details
   */
  async validatePromoCode(
    code: string,
    programId: string
  ): Promise<{
    valid: boolean;
    discount?: {
      type: "amount" | "percent";
      value: number;
    };
    promoCode?: {
      _id: string;
      code: string;
      type: "bundle_discount" | "staff_access";
      discountAmount?: number;
      discountPercent?: number;
      ownerId: string;
      allowedProgramIds?: string[];
      isActive: boolean;
      isUsed: boolean;
      expiresAt?: string;
      usedAt?: string;
      usedForProgramId?: string;
      usedForProgramTitle?: string;
      createdAt: string;
      createdBy: string;
    };
    message: string;
  }> {
    const res = await this.request<{
      valid: boolean;
      discount?: {
        type: "amount" | "percent";
        value: number;
      };
      promoCode?: {
        _id: string;
        code: string;
        type: "bundle_discount" | "staff_access";
        discountAmount?: number;
        discountPercent?: number;
        ownerId: string;
        allowedProgramIds?: string[];
        isActive: boolean;
        isUsed: boolean;
        expiresAt?: string;
        usedAt?: string;
        usedForProgramId?: string;
        usedForProgramTitle?: string;
        createdAt: string;
        createdBy: string;
      };
      message: string;
    }>(`/promo-codes/validate`, {
      method: "POST",
      body: JSON.stringify({ code, programId }),
    });

    // Backend returns validation result directly at top level (not wrapped in data field)
    // Response: {success, valid, message, discount?, code?}
    const response = res as unknown as {
      valid: boolean;
      discount?: { type: "amount" | "percent"; value: number };
      code?: {
        _id: string;
        code: string;
        type: "bundle_discount" | "staff_access";
        discountAmount?: number;
        discountPercent?: number;
        ownerId: string;
        allowedProgramIds?: string[];
        isActive: boolean;
        isUsed: boolean;
        expiresAt?: string;
        usedAt?: string;
        usedForProgramId?: string;
        usedForProgramTitle?: string;
        createdAt: string;
        createdBy: string;
      };
      message: string;
    };

    return {
      valid: response.valid || false,
      discount: response.discount,
      promoCode: response.code, // Backend returns full code object
      message: response.message || "Validation failed",
    };
  }

  // ========== Admin Promo Code Management ==========

  /**
   * Get all promo codes (Admin only)
   * @param filters - Optional filters for type, status, search, pagination
   * @returns All promo codes with pagination
   */
  async getAllPromoCodes(filters?: {
    type?: "bundle_discount" | "staff_access";
    status?: "active" | "used" | "expired";
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    codes: Array<{
      _id: string;
      code: string;
      type: "bundle_discount" | "staff_access";
      discountAmount?: number;
      discountPercent?: number;
      ownerId: string;
      ownerEmail?: string;
      ownerName?: string;
      allowedProgramIds?: string[];
      isActive: boolean;
      isUsed: boolean;
      expiresAt?: string;
      usedAt?: string;
      usedForProgramId?: string;
      usedForProgramTitle?: string;
      createdAt: string;
      createdBy: string;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const params = new URLSearchParams();
    if (filters?.type) params.append("type", filters.type);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.search) params.append("search", filters.search);
    if (filters?.page) params.append("page", filters.page.toString());
    if (filters?.limit) params.append("limit", filters.limit.toString());

    const queryString = params.toString();
    const endpoint = `/promo-codes${queryString ? `?${queryString}` : ""}`;

    const res = await this.request<{
      codes: Array<{
        _id: string;
        code: string;
        type: "bundle_discount" | "staff_access";
        discountAmount?: number;
        discountPercent?: number;
        ownerId: string;
        ownerEmail?: string;
        ownerName?: string;
        allowedProgramIds?: string[];
        isActive: boolean;
        isUsed: boolean;
        expiresAt?: string;
        usedAt?: string;
        usedForProgramId?: string;
        usedForProgramTitle?: string;
        createdAt: string;
        createdBy: string;
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(endpoint, {
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    // Backend returns {success: true, codes: [...], pagination: {...}} directly
    // NOT wrapped in a data property
    type AllCodesResponse = {
      codes?: Array<{
        _id: string;
        code: string;
        type: "bundle_discount" | "staff_access";
        discountAmount?: number;
        discountPercent?: number;
        ownerId: string;
        ownerEmail?: string;
        ownerName?: string;
        allowedProgramIds?: string[];
        isActive: boolean;
        isUsed: boolean;
        expiresAt?: string;
        usedAt?: string;
        usedForProgramId?: string;
        usedForProgramTitle?: string;
        createdAt: string;
        createdBy: string;
      }>;
      pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    };

    const response = res as AllCodesResponse;
    return {
      codes: response.codes || [],
      pagination: response.pagination || {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      },
    };
  }

  /**
   * Deactivate a promo code (Admin only)
   * @param codeId - ID of the promo code to deactivate
   */
  async deactivatePromoCode(codeId: string): Promise<void> {
    await this.request(`/promo-codes/${codeId}/deactivate`, {
      method: "PUT",
    });
  }

  /**
   * Reactivate a promo code (Admin only)
   * @param codeId - ID of the promo code to reactivate
   */
  async reactivatePromoCode(codeId: string): Promise<void> {
    await this.request(`/promo-codes/${codeId}/reactivate`, {
      method: "PUT",
    });
  }

  /**
   * Create a staff access promo code (Admin only)
   * @param payload - Staff code creation data
   * @returns Created promo code with generated code
   */
  async createStaffPromoCode(payload: {
    userId: string;
    discountPercent: number;
    allowedProgramIds?: string[];
    expiresAt?: string;
  }): Promise<{
    code: {
      _id: string;
      code: string;
      type: "staff_access";
      discountPercent: number;
      ownerId: string;
      ownerEmail?: string;
      ownerName?: string;
      allowedProgramIds?: string[];
      isActive: boolean;
      isUsed: boolean;
      expiresAt?: string;
      createdAt: string;
      createdBy: string;
    };
  }> {
    const res = await this.request<{
      code: {
        _id: string;
        code: string;
        type: "staff_access";
        discountPercent: number;
        ownerId: string;
        ownerEmail?: string;
        ownerName?: string;
        allowedProgramIds?: string[];
        isActive: boolean;
        isUsed: boolean;
        expiresAt?: string;
        createdAt: string;
        createdBy: string;
      };
    }>(`/promo-codes/staff`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!res.data) {
      throw new Error(res.message || "Failed to create staff promo code");
    }

    return res.data;
  }

  /**
   * Create a general staff promo code (Admin only)
   * POST /api/promo-codes/staff/general
   */
  async createGeneralStaffPromoCode(payload: {
    description: string;
    discountPercent: number;
    expiresAt?: string;
    isGeneral: boolean;
  }): Promise<{
    code: {
      _id: string;
      code: string;
      type: "staff_access";
      discountPercent: number;
      description?: string;
      allowedProgramIds?: string[];
      isActive: boolean;
      isUsed: boolean;
      expiresAt?: string;
      createdAt: string;
      createdBy: string;
      isGeneral?: boolean;
      usageLimit?: number;
    };
  }> {
    const res = await this.request<{
      code: {
        _id: string;
        code: string;
        type: "staff_access";
        discountPercent: number;
        description?: string;
        allowedProgramIds?: string[];
        isActive: boolean;
        isUsed: boolean;
        expiresAt?: string;
        createdAt: string;
        createdBy: string;
        isGeneral?: boolean;
        usageLimit?: number;
      };
    }>(`/promo-codes/staff/general`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!res.data) {
      throw new Error(
        res.message || "Failed to create general staff promo code"
      );
    }

    return res.data;
  }

  /**
   * Get usage history for a promo code (Admin only)
   * GET /api/promo-codes/:id/usage-history
   */
  async getPromoCodeUsageHistory(codeId: string): Promise<{
    code: string;
    type: string;
    isGeneral: boolean;
    description?: string;
    usageHistory: Array<{
      userId: string;
      userName: string;
      userEmail: string;
      usedAt: string;
      programId?: string;
      programTitle?: string;
    }>;
    usageCount: number;
  }> {
    const res = await this.request<{
      code: string;
      type: string;
      isGeneral: boolean;
      description?: string;
      usageHistory: Array<{
        userId: string;
        userName: string;
        userEmail: string;
        usedAt: string;
        programId?: string;
        programTitle?: string;
      }>;
      usageCount: number;
    }>(`/promo-codes/${codeId}/usage-history`);

    if (!res.data) {
      throw new Error(
        res.message || "Failed to fetch promo code usage history"
      );
    }

    return res.data;
  }

  /**
   * Get bundle discount configuration (Admin only)
   * GET /api/promo-codes/config
   */
  async getBundleDiscountConfig(): Promise<{
    config: {
      enabled: boolean;
      discountAmount: number;
      expiryDays: number;
    };
  }> {
    const res = await this.request<{
      config: {
        enabled: boolean;
        discountAmount: number;
        expiryDays: number;
      };
    }>(`/promo-codes/config`, {
      method: "GET",
    });

    if (!res.data) {
      throw new Error(
        res.message || "Failed to fetch bundle discount configuration"
      );
    }

    return res.data;
  }

  /**
   * Update bundle discount configuration (Admin only)
   * PUT /api/promo-codes/config
   */
  async updateBundleDiscountConfig(payload: {
    enabled: boolean;
    discountAmount: number;
    expiryDays: number;
  }): Promise<{
    config: {
      enabled: boolean;
      discountAmount: number;
      expiryDays: number;
    };
  }> {
    const res = await this.request<{
      config: {
        enabled: boolean;
        discountAmount: number;
        expiryDays: number;
      };
    }>(`/promo-codes/config`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    if (!res.data) {
      throw new Error(
        res.message || "Failed to update bundle discount configuration"
      );
    }

    return res.data;
  }
}

// Export singleton instance
const promoCodesApiClient = new PromoCodesApiClient();

// Export service methods
export const promoCodesService = {
  // User operations
  getMyPromoCodes: () => promoCodesApiClient.getMyPromoCodes(),
  validatePromoCode: (code: string, programId: string) =>
    promoCodesApiClient.validatePromoCode(code, programId),

  // Admin operations
  getAllPromoCodes: (
    filters?: Parameters<typeof promoCodesApiClient.getAllPromoCodes>[0]
  ) => promoCodesApiClient.getAllPromoCodes(filters),
  deactivatePromoCode: (codeId: string) =>
    promoCodesApiClient.deactivatePromoCode(codeId),
  reactivatePromoCode: (codeId: string) =>
    promoCodesApiClient.reactivatePromoCode(codeId),
  createStaffPromoCode: (
    payload: Parameters<typeof promoCodesApiClient.createStaffPromoCode>[0]
  ) => promoCodesApiClient.createStaffPromoCode(payload),
  createGeneralStaffPromoCode: (
    payload: Parameters<
      typeof promoCodesApiClient.createGeneralStaffPromoCode
    >[0]
  ) => promoCodesApiClient.createGeneralStaffPromoCode(payload),
  getPromoCodeUsageHistory: (codeId: string) =>
    promoCodesApiClient.getPromoCodeUsageHistory(codeId),
  getBundleDiscountConfig: () => promoCodesApiClient.getBundleDiscountConfig(),
  updateBundleDiscountConfig: (
    payload: Parameters<
      typeof promoCodesApiClient.updateBundleDiscountConfig
    >[0]
  ) => promoCodesApiClient.updateBundleDiscountConfig(payload),
};
