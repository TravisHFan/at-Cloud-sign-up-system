import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import ExportAnalyticsController from "../../../../src/controllers/analytics/ExportAnalyticsController";

// Mock all dependencies before imports
vi.mock("../../../../src/models", () => ({
  User: {
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
  Event: {
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
  Registration: {
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
  GuestRegistration: {
    find: vi.fn(),
  },
}));

vi.mock("../../../../src/models/Purchase", () => ({
  default: {
    find: vi.fn(),
  },
}));

vi.mock("../../../../src/models/DonationTransaction", () => ({
  default: {
    find: vi.fn(),
  },
}));

vi.mock("../../../../src/utils/roleUtils", () => ({
  hasPermission: vi.fn(),
  PERMISSIONS: {
    VIEW_SYSTEM_ANALYTICS: "view_system_analytics",
  },
}));

vi.mock("../../../../src/services/CorrelatedLogger", () => ({
  CorrelatedLogger: {
    fromRequest: vi.fn(() => ({
      error: vi.fn(),
      info: vi.fn(),
    })),
  },
}));

vi.mock("xlsx", () => ({
  utils: {
    book_new: vi.fn(() => ({ SheetNames: [], Sheets: {} })),
    aoa_to_sheet: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  write: vi.fn(() => Buffer.from("test")),
}));

import { hasPermission } from "../../../../src/utils/roleUtils";
import {
  User,
  Event,
  Registration,
  GuestRegistration,
} from "../../../../src/models";
import Purchase from "../../../../src/models/Purchase";
import DonationTransaction from "../../../../src/models/DonationTransaction";

describe("ExportAnalyticsController - Programs and Donations Coverage", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;
  let setHeaderMock: ReturnType<typeof vi.fn>;
  let sendMock: ReturnType<typeof vi.fn>;

  // Mock data for programs
  const mockPurchases = [
    {
      userId: "user-1",
      programId: "prog-1",
      finalPrice: 5000,
      status: "completed",
      purchaseDate: new Date("2025-01-15"),
      isClassRep: true,
      isEarlyBird: false,
      promoCode: "SAVE10",
      stripePaymentIntentId: "pi_123",
    },
    {
      userId: "user-2",
      programId: "prog-2",
      finalPrice: 7500,
      status: "pending",
      purchaseDate: new Date("2025-01-20"),
      isClassRep: false,
      isEarlyBird: true,
      promoCode: null,
      stripePaymentIntentId: "pi_456",
    },
  ];

  // Mock data for donations
  const mockDonations = [
    {
      userId: "user-1",
      donationId: "don-1",
      amount: 2500,
      type: "one-time",
      status: "completed",
      giftDate: new Date("2025-01-10"),
      stripePaymentIntentId: "pi_789",
    },
    {
      userId: "user-3",
      donationId: "don-2",
      amount: 10000,
      type: "recurring",
      status: "active",
      giftDate: new Date("2025-01-25"),
      stripePaymentIntentId: "pi_abc",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    setHeaderMock = vi.fn();
    sendMock = vi.fn();
    statusMock = vi.fn(() => ({ json: jsonMock })) as ReturnType<typeof vi.fn>;

    req = {
      query: { format: "xlsx" },
      user: {
        _id: "admin-user-123",
        role: "Super Admin",
      },
    } as unknown as Partial<Request>;

    res = {
      status: statusMock,
      json: jsonMock,
      setHeader: setHeaderMock,
      send: sendMock,
    } as unknown as Partial<Response>;

    vi.mocked(hasPermission).mockReturnValue(true);

    // Default mock chain for User
    vi.mocked(User.find).mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    } as unknown as ReturnType<typeof User.find>);

    // Default mock chain for Event
    vi.mocked(Event.find).mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    } as unknown as ReturnType<typeof Event.find>);

    // Default mock chain for Registration
    vi.mocked(Registration.find).mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    } as unknown as ReturnType<typeof Registration.find>);

    // Default mock chain for GuestRegistration
    vi.mocked(GuestRegistration.find).mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    } as unknown as ReturnType<typeof GuestRegistration.find>);
  });

  describe("xlsx format with programs data", () => {
    it("should process programs data for xlsx export", async () => {
      // Mock Purchase to return data
      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockPurchases),
      } as unknown as ReturnType<typeof Purchase.find>);

      // Mock DonationTransaction to return empty
      vi.mocked(DonationTransaction.find).mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([]),
      } as unknown as ReturnType<typeof DonationTransaction.find>);

      await ExportAnalyticsController.exportAnalytics(
        req as Request,
        res as Response,
      );

      // Should not return error
      expect(statusMock).not.toHaveBeenCalledWith(400);
      expect(statusMock).not.toHaveBeenCalledWith(401);
      expect(statusMock).not.toHaveBeenCalledWith(403);
    });
  });

  describe("xlsx format with donations data", () => {
    it("should process donations data for xlsx export", async () => {
      // Mock Purchase to return empty
      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([]),
      } as unknown as ReturnType<typeof Purchase.find>);

      // Mock DonationTransaction to return data
      vi.mocked(DonationTransaction.find).mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockDonations),
      } as unknown as ReturnType<typeof DonationTransaction.find>);

      await ExportAnalyticsController.exportAnalytics(
        req as Request,
        res as Response,
      );

      // Should not return error
      expect(statusMock).not.toHaveBeenCalledWith(400);
      expect(statusMock).not.toHaveBeenCalledWith(401);
      expect(statusMock).not.toHaveBeenCalledWith(403);
    });
  });

  describe("xlsx format with both programs and donations data", () => {
    it("should process both programs and donations data for xlsx export", async () => {
      // Mock Purchase to return data
      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockPurchases),
      } as unknown as ReturnType<typeof Purchase.find>);

      // Mock DonationTransaction to return data
      vi.mocked(DonationTransaction.find).mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockDonations),
      } as unknown as ReturnType<typeof DonationTransaction.find>);

      await ExportAnalyticsController.exportAnalytics(
        req as Request,
        res as Response,
      );

      // Should not return error
      expect(statusMock).not.toHaveBeenCalledWith(400);
      expect(statusMock).not.toHaveBeenCalledWith(401);
      expect(statusMock).not.toHaveBeenCalledWith(403);
    });

    it("should handle programs with null/undefined fields", async () => {
      const programsWithNulls = [
        {
          userId: null,
          programId: undefined,
          finalPrice: null,
          status: undefined,
          purchaseDate: null,
          isClassRep: undefined,
          isEarlyBird: undefined,
          promoCode: undefined,
          stripePaymentIntentId: undefined,
        },
      ];

      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(programsWithNulls),
      } as unknown as ReturnType<typeof Purchase.find>);

      vi.mocked(DonationTransaction.find).mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([]),
      } as unknown as ReturnType<typeof DonationTransaction.find>);

      await ExportAnalyticsController.exportAnalytics(
        req as Request,
        res as Response,
      );

      // Should handle gracefully without error
      expect(statusMock).not.toHaveBeenCalledWith(500);
    });

    it("should handle donations with null/undefined fields", async () => {
      const donationsWithNulls = [
        {
          userId: null,
          donationId: undefined,
          amount: null,
          type: undefined,
          status: undefined,
          giftDate: null,
          stripePaymentIntentId: undefined,
        },
      ];

      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([]),
      } as unknown as ReturnType<typeof Purchase.find>);

      vi.mocked(DonationTransaction.find).mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(donationsWithNulls),
      } as unknown as ReturnType<typeof DonationTransaction.find>);

      await ExportAnalyticsController.exportAnalytics(
        req as Request,
        res as Response,
      );

      // Should handle gracefully without error
      expect(statusMock).not.toHaveBeenCalledWith(500);
    });
  });
});
