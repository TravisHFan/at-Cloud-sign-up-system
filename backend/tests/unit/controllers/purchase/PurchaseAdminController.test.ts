import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import PurchaseAdminController from "../../../../src/controllers/purchase/PurchaseAdminController";
import Purchase from "../../../../src/models/Purchase";
import mongoose from "mongoose";

// Mock dependencies
vi.mock("../../../../src/models/Purchase");

describe("PurchaseAdminController", () => {
  let mockReq: Partial<Request> & { user?: any; query?: any };
  let mockRes: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup response mocks
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      query: {},
      user: undefined,
    };

    mockRes = {
      status: statusMock as any,
      json: jsonMock as any,
    };

    // Mock console.error
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("getAllPurchasesAdmin", () => {
    const userId = new mongoose.Types.ObjectId();
    const programId = new mongoose.Types.ObjectId();

    it("should return 401 if user not authenticated", async () => {
      mockReq.user = undefined;

      await PurchaseAdminController.getAllPurchasesAdmin(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Authentication required.",
      });
    });

    it("should return 403 if user is not admin (Member)", async () => {
      mockReq.user = {
        _id: userId,
        role: "Member",
      };

      await PurchaseAdminController.getAllPurchasesAdmin(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Only Super Admin and Administrator can access this.",
      });
    });

    it("should return 403 if user is Leader", async () => {
      mockReq.user = {
        _id: userId,
        role: "Leader",
      };

      await PurchaseAdminController.getAllPurchasesAdmin(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(403);
    });

    it("should allow Super Admin to access", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };

      const mockPurchases: any[] = [];

      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue(mockPurchases),
          }),
        }),
      } as any);

      await PurchaseAdminController.getAllPurchasesAdmin(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should allow Administrator to access", async () => {
      mockReq.user = {
        _id: userId,
        role: "Administrator",
      };

      const mockPurchases: any[] = [];

      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue(mockPurchases),
          }),
        }),
      } as any);

      await PurchaseAdminController.getAllPurchasesAdmin(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should return paginated purchases with default pagination", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };

      const mockPurchases = [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: "ORDER-001",
          userId: {
            _id: userId,
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
          },
          programId: {
            _id: programId,
            title: "Test Program",
          },
          fullPrice: 100,
          finalPrice: 100,
          status: "completed",
          isClassRep: false,
          isEarlyBird: false,
          createdAt: new Date(),
        },
      ];

      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue(mockPurchases),
          }),
        }),
      } as any);

      await PurchaseAdminController.getAllPurchasesAdmin(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          purchases: expect.arrayContaining([
            expect.objectContaining({
              orderNumber: "ORDER-001",
              user: expect.objectContaining({
                name: "John Doe",
                email: "john@example.com",
              }),
              program: expect.objectContaining({
                name: "Test Program",
              }),
            }),
          ]),
          pagination: {
            page: 1,
            limit: 20,
            total: 1,
            totalPages: 1,
          },
        },
      });
    });

    it("should handle custom page and limit parameters", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };
      mockReq.query = {
        page: "2",
        limit: "10",
      };

      const mockPurchases = Array.from({ length: 15 }, (_, i) => ({
        _id: new mongoose.Types.ObjectId(),
        orderNumber: `ORDER-${i + 1}`,
        userId: {
          _id: userId,
          firstName: "User",
          lastName: `${i}`,
          email: `user${i}@example.com`,
        },
        programId: {
          _id: programId,
          title: "Program",
        },
        fullPrice: 100,
        finalPrice: 100,
        status: "completed",
        isClassRep: false,
        isEarlyBird: false,
        createdAt: new Date(),
      }));

      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue(mockPurchases),
          }),
        }),
      } as any);

      await PurchaseAdminController.getAllPurchasesAdmin(
        mockReq as Request,
        mockRes as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          purchases: expect.arrayContaining([
            expect.objectContaining({ orderNumber: "ORDER-11" }),
          ]),
          pagination: {
            page: 2,
            limit: 10,
            total: 15,
            totalPages: 2,
          },
        },
      });
      // Should have skipped first 10 and returned next 5
      expect(jsonMock.mock.calls[0][0].data.purchases).toHaveLength(5);
    });

    it("should cap limit at 100", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };
      mockReq.query = {
        limit: "200",
      };

      const mockPurchases: any[] = [];

      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue(mockPurchases),
          }),
        }),
      } as any);

      await PurchaseAdminController.getAllPurchasesAdmin(
        mockReq as Request,
        mockRes as Response
      );

      expect(jsonMock.mock.calls[0][0].data.pagination.limit).toBe(100);
    });

    it("should enforce minimum page of 1", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };
      mockReq.query = {
        page: "0",
      };

      const mockPurchases: any[] = [];

      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue(mockPurchases),
          }),
        }),
      } as any);

      await PurchaseAdminController.getAllPurchasesAdmin(
        mockReq as Request,
        mockRes as Response
      );

      expect(jsonMock.mock.calls[0][0].data.pagination.page).toBe(1);
    });

    it("should enforce minimum limit of 1", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };
      mockReq.query = {
        limit: "0",
      };

      const mockPurchases: any[] = [];

      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue(mockPurchases),
          }),
        }),
      } as any);

      await PurchaseAdminController.getAllPurchasesAdmin(
        mockReq as Request,
        mockRes as Response
      );

      expect(jsonMock.mock.calls[0][0].data.pagination.limit).toBe(1);
    });

    it("should filter by status", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };
      mockReq.query = {
        status: "completed",
      };

      const mockPurchases: any[] = [];

      const findMock = vi.fn().mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue(mockPurchases),
          }),
        }),
      });

      vi.mocked(Purchase.find).mockImplementation(findMock);

      await PurchaseAdminController.getAllPurchasesAdmin(
        mockReq as Request,
        mockRes as Response
      );

      expect(findMock).toHaveBeenCalledWith({ status: "completed" });
    });

    it("should not filter when status is 'all'", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };
      mockReq.query = {
        status: "all",
      };

      const mockPurchases: any[] = [];

      const findMock = vi.fn().mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue(mockPurchases),
          }),
        }),
      });

      vi.mocked(Purchase.find).mockImplementation(findMock);

      await PurchaseAdminController.getAllPurchasesAdmin(
        mockReq as Request,
        mockRes as Response
      );

      expect(findMock).toHaveBeenCalledWith({});
    });

    it("should search by user first name", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };
      mockReq.query = {
        search: "john",
      };

      const mockPurchases = [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: "ORDER-001",
          userId: {
            _id: userId,
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
          },
          programId: {
            _id: programId,
            title: "Program A",
          },
          fullPrice: 100,
          finalPrice: 100,
          status: "completed",
          isClassRep: false,
          isEarlyBird: false,
          createdAt: new Date(),
        },
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: "ORDER-002",
          userId: {
            _id: new mongoose.Types.ObjectId(),
            firstName: "Jane",
            lastName: "Smith",
            email: "jane@example.com",
          },
          programId: {
            _id: programId,
            title: "Program B",
          },
          fullPrice: 100,
          finalPrice: 100,
          status: "completed",
          isClassRep: false,
          isEarlyBird: false,
          createdAt: new Date(),
        },
      ];

      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue(mockPurchases),
          }),
        }),
      } as any);

      await PurchaseAdminController.getAllPurchasesAdmin(
        mockReq as Request,
        mockRes as Response
      );

      const purchases = jsonMock.mock.calls[0][0].data.purchases;
      expect(purchases).toHaveLength(1);
      expect(purchases[0].user.name).toBe("John Doe");
    });

    it("should search by user last name", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };
      mockReq.query = {
        search: "smith",
      };

      const mockPurchases = [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: "ORDER-001",
          userId: {
            _id: userId,
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
          },
          programId: {
            _id: programId,
            title: "Program A",
          },
          fullPrice: 100,
          finalPrice: 100,
          status: "completed",
          isClassRep: false,
          isEarlyBird: false,
          createdAt: new Date(),
        },
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: "ORDER-002",
          userId: {
            _id: new mongoose.Types.ObjectId(),
            firstName: "Jane",
            lastName: "Smith",
            email: "jane@example.com",
          },
          programId: {
            _id: programId,
            title: "Program B",
          },
          fullPrice: 100,
          finalPrice: 100,
          status: "completed",
          isClassRep: false,
          isEarlyBird: false,
          createdAt: new Date(),
        },
      ];

      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue(mockPurchases),
          }),
        }),
      } as any);

      await PurchaseAdminController.getAllPurchasesAdmin(
        mockReq as Request,
        mockRes as Response
      );

      const purchases = jsonMock.mock.calls[0][0].data.purchases;
      expect(purchases).toHaveLength(1);
      expect(purchases[0].user.name).toBe("Jane Smith");
    });

    it("should search by email", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };
      mockReq.query = {
        search: "jane@",
      };

      const mockPurchases = [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: "ORDER-001",
          userId: {
            _id: userId,
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
          },
          programId: {
            _id: programId,
            title: "Program A",
          },
          fullPrice: 100,
          finalPrice: 100,
          status: "completed",
          isClassRep: false,
          isEarlyBird: false,
          createdAt: new Date(),
        },
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: "ORDER-002",
          userId: {
            _id: new mongoose.Types.ObjectId(),
            firstName: "Jane",
            lastName: "Smith",
            email: "jane@example.com",
          },
          programId: {
            _id: programId,
            title: "Program B",
          },
          fullPrice: 100,
          finalPrice: 100,
          status: "completed",
          isClassRep: false,
          isEarlyBird: false,
          createdAt: new Date(),
        },
      ];

      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue(mockPurchases),
          }),
        }),
      } as any);

      await PurchaseAdminController.getAllPurchasesAdmin(
        mockReq as Request,
        mockRes as Response
      );

      const purchases = jsonMock.mock.calls[0][0].data.purchases;
      expect(purchases).toHaveLength(1);
      expect(purchases[0].user.email).toBe("jane@example.com");
    });

    it("should search by program title", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };
      mockReq.query = {
        search: "workshop",
      };

      const mockPurchases = [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: "ORDER-001",
          userId: {
            _id: userId,
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
          },
          programId: {
            _id: programId,
            title: "Workshop on Testing",
          },
          fullPrice: 100,
          finalPrice: 100,
          status: "completed",
          isClassRep: false,
          isEarlyBird: false,
          createdAt: new Date(),
        },
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: "ORDER-002",
          userId: {
            _id: new mongoose.Types.ObjectId(),
            firstName: "Jane",
            lastName: "Smith",
            email: "jane@example.com",
          },
          programId: {
            _id: programId,
            title: "Webinar on Security",
          },
          fullPrice: 100,
          finalPrice: 100,
          status: "completed",
          isClassRep: false,
          isEarlyBird: false,
          createdAt: new Date(),
        },
      ];

      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue(mockPurchases),
          }),
        }),
      } as any);

      await PurchaseAdminController.getAllPurchasesAdmin(
        mockReq as Request,
        mockRes as Response
      );

      const purchases = jsonMock.mock.calls[0][0].data.purchases;
      expect(purchases).toHaveLength(1);
      expect(purchases[0].program.name).toBe("Workshop on Testing");
    });

    it("should search by order number", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };
      mockReq.query = {
        search: "order-002",
      };

      const mockPurchases = [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: "ORDER-001",
          userId: {
            _id: userId,
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
          },
          programId: {
            _id: programId,
            title: "Program A",
          },
          fullPrice: 100,
          finalPrice: 100,
          status: "completed",
          isClassRep: false,
          isEarlyBird: false,
          createdAt: new Date(),
        },
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: "ORDER-002",
          userId: {
            _id: new mongoose.Types.ObjectId(),
            firstName: "Jane",
            lastName: "Smith",
            email: "jane@example.com",
          },
          programId: {
            _id: programId,
            title: "Program B",
          },
          fullPrice: 100,
          finalPrice: 100,
          status: "completed",
          isClassRep: false,
          isEarlyBird: false,
          createdAt: new Date(),
        },
      ];

      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue(mockPurchases),
          }),
        }),
      } as any);

      await PurchaseAdminController.getAllPurchasesAdmin(
        mockReq as Request,
        mockRes as Response
      );

      const purchases = jsonMock.mock.calls[0][0].data.purchases;
      expect(purchases).toHaveLength(1);
      expect(purchases[0].orderNumber).toBe("ORDER-002");
    });

    it("should handle missing user fields gracefully", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };

      const mockPurchases = [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: "ORDER-001",
          userId: {
            _id: userId,
            username: "johndoe123",
            email: "john@example.com",
            // Missing firstName and lastName
          },
          programId: {
            _id: programId,
            title: "Test Program",
          },
          fullPrice: 100,
          finalPrice: 100,
          status: "completed",
          isClassRep: false,
          isEarlyBird: false,
          createdAt: new Date(),
        },
      ];

      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue(mockPurchases),
          }),
        }),
      } as any);

      await PurchaseAdminController.getAllPurchasesAdmin(
        mockReq as Request,
        mockRes as Response
      );

      const purchases = jsonMock.mock.calls[0][0].data.purchases;
      expect(purchases[0].user.name).toBe("johndoe123");
    });

    it("should handle completely missing user", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };

      const mockPurchases = [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: "ORDER-001",
          userId: null,
          programId: {
            _id: programId,
            title: "Test Program",
          },
          fullPrice: 100,
          finalPrice: 100,
          status: "completed",
          isClassRep: false,
          isEarlyBird: false,
          createdAt: new Date(),
        },
      ];

      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue(mockPurchases),
          }),
        }),
      } as any);

      await PurchaseAdminController.getAllPurchasesAdmin(
        mockReq as Request,
        mockRes as Response
      );

      const purchases = jsonMock.mock.calls[0][0].data.purchases;
      expect(purchases[0].user.name).toBe("Unknown User");
    });

    it("should handle missing program", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };

      const mockPurchases = [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: "ORDER-001",
          userId: {
            _id: userId,
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
          },
          programId: null,
          fullPrice: 100,
          finalPrice: 100,
          status: "completed",
          isClassRep: false,
          isEarlyBird: false,
          createdAt: new Date(),
        },
      ];

      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue(mockPurchases),
          }),
        }),
      } as any);

      await PurchaseAdminController.getAllPurchasesAdmin(
        mockReq as Request,
        mockRes as Response
      );

      const purchases = jsonMock.mock.calls[0][0].data.purchases;
      expect(purchases[0].program.name).toBe("Unknown Program");
    });

    it("should include all purchase fields in response", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };

      const purchaseDate = new Date();
      const createdAt = new Date();

      const mockPurchases = [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: "ORDER-001",
          userId: {
            _id: userId,
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
          },
          programId: {
            _id: programId,
            title: "Test Program",
          },
          fullPrice: 200,
          classRepDiscount: 20,
          earlyBirdDiscount: 10,
          promoDiscountAmount: 5,
          promoDiscountPercent: 10,
          finalPrice: 150,
          isClassRep: true,
          isEarlyBird: true,
          promoCode: "SAVE10",
          status: "completed",
          purchaseDate,
          createdAt,
          paymentMethod: {
            type: "card",
            brand: "visa",
            last4: "4242",
          },
        },
      ];

      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue(mockPurchases),
          }),
        }),
      } as any);

      await PurchaseAdminController.getAllPurchasesAdmin(
        mockReq as Request,
        mockRes as Response
      );

      const purchase = jsonMock.mock.calls[0][0].data.purchases[0];
      expect(purchase).toMatchObject({
        orderNumber: "ORDER-001",
        fullPrice: 200,
        classRepDiscount: 20,
        earlyBirdDiscount: 10,
        promoDiscountAmount: 5,
        promoDiscountPercent: 10,
        finalPrice: 150,
        isClassRep: true,
        isEarlyBird: true,
        promoCode: "SAVE10",
        status: "completed",
        purchaseDate,
        createdAt,
        paymentMethod: {
          type: "card",
          brand: "visa",
          last4: "4242",
        },
      });
    });

    it("should handle database errors", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };

      const dbError = new Error("Database connection failed");

      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockRejectedValue(dbError),
          }),
        }),
      } as any);

      await PurchaseAdminController.getAllPurchasesAdmin(
        mockReq as Request,
        mockRes as Response
      );

      expect(console.error).toHaveBeenCalledWith(
        "Error fetching admin purchases:",
        dbError
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: "Failed to fetch purchases.",
      });
    });

    it("should sort purchases by createdAt descending", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };

      const mockPurchases: any[] = [];

      const sortMock = vi.fn().mockResolvedValue(mockPurchases);
      const populateMock2 = vi.fn().mockReturnValue({
        sort: sortMock,
      });
      const populateMock1 = vi.fn().mockReturnValue({
        populate: populateMock2,
      });

      vi.mocked(Purchase.find).mockReturnValue({
        populate: populateMock1,
      } as any);

      await PurchaseAdminController.getAllPurchasesAdmin(
        mockReq as Request,
        mockRes as Response
      );

      expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
    });

    it("should populate userId and programId with correct fields", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };

      const mockPurchases: any[] = [];

      const sortMock = vi.fn().mockResolvedValue(mockPurchases);
      const populateMock2 = vi.fn().mockReturnValue({
        sort: sortMock,
      });
      const populateMock1 = vi.fn().mockReturnValue({
        populate: populateMock2,
      });

      vi.mocked(Purchase.find).mockReturnValue({
        populate: populateMock1,
      } as any);

      await PurchaseAdminController.getAllPurchasesAdmin(
        mockReq as Request,
        mockRes as Response
      );

      expect(populateMock1).toHaveBeenCalledWith({
        path: "userId",
        select: "firstName lastName email username",
      });
      expect(populateMock2).toHaveBeenCalledWith({
        path: "programId",
        select: "title startDate endDate",
      });
    });

    it("should handle empty search string", async () => {
      mockReq.user = {
        _id: userId,
        role: "Super Admin",
      };
      mockReq.query = {
        search: "",
      };

      const mockPurchases = [
        {
          _id: new mongoose.Types.ObjectId(),
          orderNumber: "ORDER-001",
          userId: {
            _id: userId,
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
          },
          programId: {
            _id: programId,
            title: "Test Program",
          },
          fullPrice: 100,
          finalPrice: 100,
          status: "completed",
          isClassRep: false,
          isEarlyBird: false,
          createdAt: new Date(),
        },
      ];

      vi.mocked(Purchase.find).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue(mockPurchases),
          }),
        }),
      } as any);

      await PurchaseAdminController.getAllPurchasesAdmin(
        mockReq as Request,
        mockRes as Response
      );

      // Should return all purchases when search is empty
      const purchases = jsonMock.mock.calls[0][0].data.purchases;
      expect(purchases).toHaveLength(1);
    });
  });
});
