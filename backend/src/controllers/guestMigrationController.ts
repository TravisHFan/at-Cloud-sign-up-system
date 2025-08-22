import { Request, Response } from "express";
import GuestMigrationService from "../services/GuestMigrationService";
import GuestRegistration from "../models/GuestRegistration";

export class GuestMigrationController {
  // GET /api/guest-migration/eligible?email=...
  static async getEligibleByEmail(req: Request, res: Response) {
    try {
      const email = String(req.query.email || "")
        .trim()
        .toLowerCase();
      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Missing required query parameter: email",
        });
      }

      const eligible =
        await GuestMigrationService.detectGuestRegistrationsByEmail(email);
      return res.status(200).json({ success: true, data: eligible });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: (error as any)?.message || "Failed to fetch eligible guests",
      });
    }
  }

  // POST /api/guest-migration/validate { userId, email }
  static async validate(req: Request, res: Response) {
    try {
      const { userId, email } = req.body || {};
      if (!userId || !email) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: userId, email",
        });
      }
      const result = await GuestMigrationService.validateMigrationEligibility(
        String(userId),
        String(email).toLowerCase()
      );
      if (!result.ok) {
        return res.status(400).json({ success: false, message: result.reason });
      }
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          (error as any)?.message || "Failed to validate migration eligibility",
      });
    }
  }

  // POST /api/guest-migration/perform { userId, email }
  static async perform(req: Request, res: Response) {
    try {
      const { userId, email } = req.body || {};
      if (!userId || !email) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: userId, email",
        });
      }

      const result = await GuestMigrationService.performGuestToUserMigration(
        String(userId),
        String(email).toLowerCase()
      );
      if (!result.ok) {
        return res.status(400).json({ success: false, message: result.error });
      }

      // Return a quick summary after operation
      const remaining = await GuestRegistration.countDocuments({
        email: String(email).toLowerCase(),
        migrationStatus: "pending",
      });
      return res.status(200).json({
        success: true,
        data: { modified: result.modified, remainingPending: remaining },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: (error as any)?.message || "Failed to perform migration",
      });
    }
  }
}

export default GuestMigrationController;
