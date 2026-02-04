/**
 * Tests for AnalyticsController facade methods
 * These tests cover the dynamic import and delegation paths
 * for getProgramAnalytics, getDonationAnalytics, getFinancialSummary, and getTrends
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { silenceConsole } from "../../test-utils/silenceConsole";
import { Request, Response } from "express";
import { AnalyticsController } from "../../../src/controllers/analyticsController";

// Mock the underlying controllers
vi.mock(
  "../../../src/controllers/analytics/ProgramAnalyticsController",
  () => ({
    default: {
      getProgramAnalytics: vi.fn(),
    },
  }),
);

vi.mock(
  "../../../src/controllers/analytics/DonationAnalyticsController",
  () => ({
    default: {
      getDonationAnalytics: vi.fn(),
    },
  }),
);

vi.mock(
  "../../../src/controllers/analytics/FinancialAnalyticsController",
  () => ({
    default: {
      getFinancialSummary: vi.fn(),
    },
  }),
);

vi.mock("../../../src/controllers/analytics/TrendsAnalyticsController", () => ({
  default: {
    getTrends: vi.fn(),
  },
}));

// Mock request/response helpers
const createMockRequest = (): Partial<Request> => ({
  user: { id: "user123", role: "Administrator" } as unknown as Request["user"],
  query: {},
});

const createMockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis() as unknown as Response["status"],
    json: vi.fn().mockReturnThis() as unknown as Response["json"],
  };
  return res;
};

describe("AnalyticsController Facade Delegation", () => {
  let restoreConsole: (() => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    restoreConsole = silenceConsole(["error"]);
  });

  afterEach(() => {
    restoreConsole && restoreConsole();
    vi.restoreAllMocks();
  });

  describe("getProgramAnalytics", () => {
    it("should delegate to ProgramAnalyticsController.getProgramAnalytics", async () => {
      const { default: ProgramAnalyticsController } =
        await import("../../../src/controllers/analytics/ProgramAnalyticsController");
      const req = createMockRequest();
      const res = createMockResponse();

      vi.mocked(
        ProgramAnalyticsController.getProgramAnalytics,
      ).mockResolvedValue(undefined);

      await AnalyticsController.getProgramAnalytics(
        req as Request,
        res as Response,
      );

      expect(
        ProgramAnalyticsController.getProgramAnalytics,
      ).toHaveBeenCalledWith(req, res);
    });
  });

  describe("getDonationAnalytics", () => {
    it("should delegate to DonationAnalyticsController.getDonationAnalytics", async () => {
      const { default: DonationAnalyticsController } =
        await import("../../../src/controllers/analytics/DonationAnalyticsController");
      const req = createMockRequest();
      const res = createMockResponse();

      vi.mocked(
        DonationAnalyticsController.getDonationAnalytics,
      ).mockResolvedValue(undefined);

      await AnalyticsController.getDonationAnalytics(
        req as Request,
        res as Response,
      );

      expect(
        DonationAnalyticsController.getDonationAnalytics,
      ).toHaveBeenCalledWith(req, res);
    });
  });

  describe("getFinancialSummary", () => {
    it("should delegate to FinancialAnalyticsController.getFinancialSummary", async () => {
      const { default: FinancialAnalyticsController } =
        await import("../../../src/controllers/analytics/FinancialAnalyticsController");
      const req = createMockRequest();
      const res = createMockResponse();

      vi.mocked(
        FinancialAnalyticsController.getFinancialSummary,
      ).mockResolvedValue(undefined);

      await AnalyticsController.getFinancialSummary(
        req as Request,
        res as Response,
      );

      expect(
        FinancialAnalyticsController.getFinancialSummary,
      ).toHaveBeenCalledWith(req, res);
    });
  });

  describe("getTrends", () => {
    it("should delegate to TrendsAnalyticsController.getTrends", async () => {
      const { default: TrendsAnalyticsController } =
        await import("../../../src/controllers/analytics/TrendsAnalyticsController");
      const req = createMockRequest();
      const res = createMockResponse();

      vi.mocked(TrendsAnalyticsController.getTrends).mockResolvedValue(
        undefined,
      );

      await AnalyticsController.getTrends(req as Request, res as Response);

      expect(TrendsAnalyticsController.getTrends).toHaveBeenCalledWith(
        req,
        res,
      );
    });
  });
});
