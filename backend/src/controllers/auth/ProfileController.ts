/**
 * ProfileController
 * Handles user profile retrieval
 * Extracted from authController.ts
 */

import { Request, Response } from "express";
import { UserDocLike } from "./types";

export default class ProfileController {
  static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const u = req.user as unknown as UserDocLike & {
        createdAt?: Date | string;
        isActive?: boolean;
      };
      res.status(200).json({
        success: true,
        data: {
          user: {
            id: u._id,
            username: u.username,
            email: u.email,
            phone: u.phone,
            firstName: u.firstName,
            lastName: u.lastName,
            gender: u.gender,
            avatar: u.avatar,
            role: u.role,
            isAtCloudLeader: u.isAtCloudLeader,
            roleInAtCloud: u.roleInAtCloud,
            occupation: u.occupation,
            company: u.company,
            weeklyChurch: u.weeklyChurch,
            homeAddress: u.homeAddress,
            churchAddress: u.churchAddress,
            lastLogin: u.lastLogin,
            createdAt: u.createdAt,
            isVerified: u.isVerified,
            isActive: u.isActive,
          },
        },
      });
    } catch (error: unknown) {
      console.error("Get profile error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve profile.",
      });
    }
  }
}
