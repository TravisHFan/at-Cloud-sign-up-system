import { useState, useEffect, useCallback } from "react";
import { promoCodesService } from "../services/api/promoCodes.api";
import type { PromoCodeResponse } from "../components/admin/promo-codes/PromoCodeList";

export type PromoCodeTypeFilter =
  | "all"
  | "bundle_discount"
  | "staff_access"
  | "reward";
export type PromoCodeStatusFilter = "all" | "active" | "used" | "expired";

export interface UsePromoCodeOperationsReturn {
  // Data
  codes: PromoCodeResponse[];
  loading: boolean;
  error: string | null;
  totalPages: number;
  totalCodes: number;

  // Pagination
  currentPage: number;
  setCurrentPage: (page: number) => void;

  // Operations
  fetchCodes: () => Promise<void>;
  deactivateCode: (id: string) => Promise<void>;
  reactivateCode: (id: string) => Promise<void>;
  deleteCode: (id: string) => Promise<void>;

  // Loading states for operations
  isDeactivating: boolean;
  isReactivating: boolean;
  isDeleting: boolean;

  // Copy functionality
  copiedCode: string | null;
  copyCode: (code: string) => Promise<void>;
}

/**
 * Custom hook for managing promo code operations (fetch, deactivate, reactivate)
 *
 * @param typeFilter - Filter by code type (all, bundle_discount, staff_access)
 * @param statusFilter - Filter by status (all, active, used, expired)
 * @param searchQuery - Search query for code or owner
 * @param limit - Number of items per page (default: 20)
 * @returns Object with codes data, loading states, and operation functions
 */
export function usePromoCodeOperations(
  typeFilter: PromoCodeTypeFilter,
  statusFilter: PromoCodeStatusFilter,
  searchQuery: string,
  limit: number = 20
): UsePromoCodeOperationsReturn {
  // Data state
  const [codes, setCodes] = useState<PromoCodeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCodes, setTotalCodes] = useState(0);

  // Operation loading states
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Copy feedback state
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Fetch codes with filters
  const fetchCodes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const filters: {
        page: number;
        limit: number;
        type?: "bundle_discount" | "staff_access" | "reward";
        status?: "active" | "used" | "expired";
        search?: string;
      } = {
        page: currentPage,
        limit,
      };

      if (typeFilter !== "all") filters.type = typeFilter;
      if (statusFilter !== "all") filters.status = statusFilter;
      if (searchQuery.trim()) filters.search = searchQuery.trim();

      const response = await promoCodesService.getAllPromoCodes(filters);

      setCodes(response.codes);
      setTotalPages(response.pagination.totalPages);
      setTotalCodes(response.pagination.total);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch promo codes";
      setError(errorMessage);
      setCodes([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, typeFilter, statusFilter, searchQuery, limit]);

  // Auto-fetch when dependencies change
  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  // Deactivate code
  const deactivateCode = useCallback(
    async (id: string) => {
      try {
        setIsDeactivating(true);
        await promoCodesService.deactivatePromoCode(id);
        await fetchCodes(); // Refresh list
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to deactivate code";
        throw new Error(errorMessage);
      } finally {
        setIsDeactivating(false);
      }
    },
    [fetchCodes]
  );

  // Reactivate code
  const reactivateCode = useCallback(
    async (id: string) => {
      try {
        setIsReactivating(true);
        await promoCodesService.reactivatePromoCode(id);
        await fetchCodes(); // Refresh list
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to reactivate code";
        throw new Error(errorMessage);
      } finally {
        setIsReactivating(false);
      }
    },
    [fetchCodes]
  );

  // Delete code
  const deleteCode = useCallback(
    async (id: string) => {
      try {
        setIsDeleting(true);
        await promoCodesService.deletePromoCode(id);
        await fetchCodes(); // Refresh list
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to delete code";
        throw new Error(errorMessage);
      } finally {
        setIsDeleting(false);
      }
    },
    [fetchCodes]
  );

  // Copy code to clipboard
  const copyCode = useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
      throw new Error("Failed to copy code to clipboard");
    }
  }, []);

  return {
    // Data
    codes,
    loading,
    error,
    totalPages,
    totalCodes,

    // Pagination
    currentPage,
    setCurrentPage,

    // Operations
    fetchCodes,
    deactivateCode,
    reactivateCode,
    deleteCode,

    // Loading states
    isDeactivating,
    isReactivating,
    isDeleting,

    // Copy functionality
    copiedCode,
    copyCode,
  };
}
