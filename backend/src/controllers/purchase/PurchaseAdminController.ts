import { Request, Response } from "express";
import mongoose from "mongoose";
import Purchase from "../../models/Purchase";

/**
 * PurchaseAdminController
 * Handles admin purchase listing with pagination and search
 */
class PurchaseAdminController {
  /**
   * Get all purchases for admin (Super Admin & Administrator only)
   * GET /api/admin/purchases
   * Supports pagination and search
   */
  static async getAllPurchasesAdmin(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }

      // Check admin role
      if (
        req.user.role !== "Super Admin" &&
        req.user.role !== "Administrator"
      ) {
        res.status(403).json({
          success: false,
          message: "Only Super Admin and Administrator can access this.",
        });
        return;
      }

      const {
        page = 1,
        limit = 20,
        search = "",
        status,
      } = req.query as {
        page?: string;
        limit?: string;
        search?: string;
        status?: string;
      };

      const pageNum = Math.max(1, parseInt(page as string, 10));
      const limitNum = Math.min(
        100,
        Math.max(1, parseInt(limit as string, 10))
      );
      const skip = (pageNum - 1) * limitNum;

      // Build query
      const query: Record<string, unknown> = {};

      // Status filter
      if (status && status !== "all") {
        query.status = status;
      }

      // Fetch ALL purchases matching status filter (we'll filter by search client-side)
      // This is necessary because search includes populated fields (user name, program title)
      const allPurchases = await Purchase.find(query)
        .populate({
          path: "userId",
          select: "firstName lastName email username",
        })
        .populate({
          path: "programId",
          select: "title startDate endDate",
        })
        .sort({ createdAt: -1 });

      // Apply search filter after population (if search is provided)
      let filteredPurchases = allPurchases;
      if (search) {
        const searchLower = search.toLowerCase();
        filteredPurchases = allPurchases.filter((purchase) => {
          const user = purchase.userId as {
            firstName?: string;
            lastName?: string;
            email?: string;
            username?: string;
          };
          const program = purchase.programId as { title?: string };

          const userFirstName = user?.firstName?.toLowerCase() || "";
          const userLastName = user?.lastName?.toLowerCase() || "";
          const userEmail = user?.email?.toLowerCase() || "";
          const userName = user?.username?.toLowerCase() || "";
          const programTitle = program?.title?.toLowerCase() || "";
          const orderNumber = purchase.orderNumber?.toLowerCase() || "";

          return (
            userFirstName.includes(searchLower) ||
            userLastName.includes(searchLower) ||
            userEmail.includes(searchLower) ||
            userName.includes(searchLower) ||
            programTitle.includes(searchLower) ||
            orderNumber.includes(searchLower)
          );
        });
      }

      // Apply pagination to filtered results
      const total = filteredPurchases.length;
      const paginatedPurchases = filteredPurchases.slice(skip, skip + limitNum);

      // Format response
      const formattedPurchases = paginatedPurchases.map((purchase) => {
        const user = purchase.userId as {
          _id?: unknown;
          firstName?: string;
          lastName?: string;
          email?: string;
          username?: string;
        };
        const program = purchase.programId as {
          _id?: unknown;
          title?: string;
        };

        return {
          id: purchase._id,
          orderNumber: purchase.orderNumber,
          user: {
            id: user?._id,
            name:
              `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
              user?.username ||
              "Unknown User",
            email: user?.email || "",
          },
          program: {
            id: program?._id,
            name: program?.title || "Unknown Program",
          },
          fullPrice: purchase.fullPrice,
          classRepDiscount: purchase.classRepDiscount,
          earlyBirdDiscount: purchase.earlyBirdDiscount,
          promoDiscountAmount: purchase.promoDiscountAmount || 0,
          promoDiscountPercent: purchase.promoDiscountPercent || 0,
          finalPrice: purchase.finalPrice,
          isClassRep: purchase.isClassRep,
          isEarlyBird: purchase.isEarlyBird,
          promoCode: purchase.promoCode,
          status: purchase.status,
          purchaseDate: purchase.purchaseDate,
          createdAt: purchase.createdAt,
          paymentMethod: purchase.paymentMethod,
        };
      });

      res.status(200).json({
        success: true,
        data: {
          purchases: formattedPurchases,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      console.error("Error fetching admin purchases:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch purchases.",
      });
    }
  }
}

export default PurchaseAdminController;
