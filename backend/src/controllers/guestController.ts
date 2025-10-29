import { Request, Response } from "express";
import { validationResult } from "express-validator";
import type { Result, ValidationError } from "express-validator";
import { GuestRegistration, Event, IEventRole } from "../models";
import { User } from "../models";
import {
  validateGuestUniqueness,
  validateGuestRateLimit,
} from "../middleware/guestValidation";
import { EmailService } from "../services/infrastructure/EmailServiceFacade";
import crypto from "crypto";
import { socketService } from "../services/infrastructure/SocketService";
import mongoose from "mongoose";
import { CachePatterns } from "../services";
import { createLogger } from "../services/LoggerService";
import { ResponseBuilderService } from "../services/ResponseBuilderService";
import { lockService } from "../services/LockService";
import { CapacityService } from "../services/CapacityService";
import { CorrelatedLogger } from "../services/CorrelatedLogger";
import { createGuestInvitationDeclineToken } from "../utils/guestInvitationDeclineToken";
import { TrioNotificationService } from "../services/notifications/TrioNotificationService";

/**
 * Guest Registration Controller
 * Handles guest user registrations for events without requiring full user accounts
 */
export type EventLike = {
  _id?: mongoose.Types.ObjectId | string;
  title?: string;
  date?: unknown;
  location?: unknown;
  time?: unknown;
  endTime?: unknown;
  endDate?: unknown;
  timeZone?: unknown;
  format?: unknown;
  isHybrid?: unknown;
  zoomLink?: unknown;
  agenda?: unknown;
  purpose?: unknown;
  meetingId?: unknown;
  passcode?: unknown;
  organizerDetails?: Array<{ email?: string } | Record<string, unknown>>;
  createdBy?: unknown;
  roles?: IEventRole[];
  registrationDeadline?: Date | string | null;
};

export type UserLike = {
  _id?: mongoose.Types.ObjectId | string;
  firstName?: string;
  lastName?: string;
};
export type RequestWithUser = Request & { user?: UserLike; userRole?: string };
type UserModelLike = {
  findOne?: (
    query: Record<string, unknown>
  ) => { select?: (fields: string) => Promise<unknown> } | Promise<unknown>;
};
type SavedGuest = {
  _id: mongoose.Types.ObjectId;
  registrationDate: Date;
  status?: string;
};

// Narrowing helpers to keep casts minimal and avoid `any`
const asString = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;
const asBool = (v: unknown): boolean | undefined =>
  typeof v === "boolean" ? v : undefined;
const asDateOrString = (v: unknown): Date | string | undefined =>
  v instanceof Date || typeof v === "string" ? (v as Date | string) : undefined;

export class GuestController {
  // Structured logger for this controller (console output preserved for tests)
  private static log = createLogger("GuestController");
  /**
   * Register a guest for an event role
   * POST /api/events/:eventId/guest-signup
   */
  static async registerGuest(req: Request, res: Response): Promise<void> {
    const { GuestRegistrationController } = await import(
      "./guest/GuestRegistrationController"
    );
    return GuestRegistrationController.registerGuest(req, res);
  }

  /**
   * Validate a guest invitation decline token and return summary info
   * GET /api/guest/decline/:token
   */
  static async getDeclineTokenInfo(req: Request, res: Response): Promise<void> {
    const { default: GuestDeclineController } = await import(
      "./guest/GuestDeclineController"
    );
    return GuestDeclineController.getDeclineTokenInfo(req, res);
  }

  /**
   * Submit a guest invitation decline
   * POST /api/guest/decline/:token  { reason?: string }
   */
  static async submitDecline(req: Request, res: Response): Promise<void> {
    const { default: GuestDeclineController } = await import(
      "./guest/GuestDeclineController"
    );
    return GuestDeclineController.submitDecline(req, res);
  }

  /**
   * Re-send manage link (regenerate token and email) for a guest registration
   * POST /api/guest-registrations/:id/resend-manage-link
   * Admin-only (route-protected)
   */
  static async resendManageLink(req: Request, res: Response): Promise<void> {
    const { default: GuestManageLinkController } = await import(
      "./guest/GuestManageLinkController"
    );
    return GuestManageLinkController.resendManageLink(req, res);
  }

  /**
   * Get guest registrations for an event
   * Admins receive full admin JSON; non-admins receive public JSON (no email/phone)
   * GET /api/events/:eventId/guests
   */
  static async getEventGuests(req: Request, res: Response): Promise<void> {
    const { default: GuestListController } = await import(
      "./guest/GuestListController"
    );
    return GuestListController.getEventGuests(req, res);
  }

  /**
   * Cancel a guest registration
   * DELETE /api/guest-registrations/:id
   */
  static async cancelGuestRegistration(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: GuestCancellationController } = await import(
      "./guest/GuestCancellationController"
    );
    return GuestCancellationController.cancelGuestRegistration(req, res);
  }

  /**
   * Update guest registration details
   * PUT /api/guest-registrations/:id
   */
  static async updateGuestRegistration(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: GuestUpdateController } = await import(
      "./guest/GuestUpdateController"
    );
    return GuestUpdateController.updateGuestRegistration(req, res);
  }

  /**
   * Get guest registration by ID (for email links)
   * GET /api/guest-registrations/:id
   */
  static async getGuestRegistration(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: GuestRetrievalController } = await import(
      "./guest/GuestRetrievalController"
    );
    return GuestRetrievalController.getGuestRegistration(req, res);
  }

  /**
   * Get guest registration by token
   * GET /api/guest/manage/:token
   */
  static async getGuestByToken(req: Request, res: Response): Promise<void> {
    const { default: GuestTokenRetrievalController } = await import(
      "./guest/GuestTokenRetrievalController"
    );
    return GuestTokenRetrievalController.getGuestByToken(req, res);
  }

  /**
   * Update guest registration by token
   * PUT /api/guest/manage/:token
   */
  static async updateByToken(req: Request, res: Response): Promise<void> {
    const { default: GuestTokenUpdateController } = await import(
      "./guest/GuestTokenUpdateController"
    );
    return GuestTokenUpdateController.updateByToken(req, res);
  }

  /**
   * Cancel guest registration by token
   * DELETE /api/guest/manage/:token
   */
  static async cancelByToken(req: Request, res: Response): Promise<void> {
    const { default: GuestTokenCancellationController } = await import(
      "./guest/GuestTokenCancellationController"
    );
    return GuestTokenCancellationController.cancelByToken(req, res);
  }

  /**
   * Move a guest registration between roles (admin/organizer management operation)
   * POST /api/events/:id/manage/move-guest
   */
  static async moveGuestBetweenRoles(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: GuestRoleManagementController } = await import(
      "./guest/GuestRoleManagementController"
    );
    return GuestRoleManagementController.moveGuestBetweenRoles(req, res);
  }
}

export default GuestController;
