import { Request, Response } from "express";
import { truncateIpToCidr } from "../../utils/privacy";
import { registrationFailureCounter } from "../../services/PrometheusMetricsService";
import { CorrelatedLogger } from "../../services/CorrelatedLogger";

interface RoleSnapshot {
  id: string;
  name: string;
  description?: string;
  openToPublic?: boolean;
  capacity?: number;
}

export class ValidationHelper {
  /**
   * Validate slug parameter
   * Returns false if validation fails (response already sent)
   */
  static validateSlug(
    slug: string | undefined,
    log: CorrelatedLogger,
    req: Request,
    res: Response
  ): boolean {
    const requestId = (req.headers["x-request-id"] as string) || undefined;
    const rawIp =
      typeof req.ip === "string"
        ? req.ip
        : typeof (req.socket as { remoteAddress?: string }).remoteAddress ===
          "string"
        ? (req.socket as { remoteAddress?: string }).remoteAddress!
        : "";
    const ipCidr = truncateIpToCidr(rawIp);

    if (!slug) {
      log.warn("Public registration validation failure", undefined, {
        reason: "missing_slug",
        requestId,
        ipCidr,
      });
      res.status(400).json({ success: false, message: "Missing slug" });
      try {
        registrationFailureCounter.inc({ reason: "validation" });
      } catch {}
      return false;
    }
    return true;
  }

  /**
   * Validate roleId parameter
   * Returns false if validation fails (response already sent)
   */
  static validateRoleId(
    roleId: string | undefined,
    slug: string,
    log: CorrelatedLogger,
    req: Request,
    res: Response
  ): boolean {
    const requestId = (req.headers["x-request-id"] as string) || undefined;
    const rawIp =
      typeof req.ip === "string"
        ? req.ip
        : typeof (req.socket as { remoteAddress?: string }).remoteAddress ===
          "string"
        ? (req.socket as { remoteAddress?: string }).remoteAddress!
        : "";
    const ipCidr = truncateIpToCidr(rawIp);

    if (!roleId) {
      log.warn("Public registration validation failure", undefined, {
        reason: "missing_roleId",
        requestId,
        ipCidr,
        slug,
      });
      res.status(400).json({ success: false, message: "roleId is required" });
      try {
        registrationFailureCounter.inc({ reason: "validation" });
      } catch {}
      return false;
    }
    return true;
  }

  /**
   * Validate attendee fields (name and email required)
   * Returns false if validation fails (response already sent)
   */
  static validateAttendee(
    attendee: { name?: string; email?: string; phone?: string } | undefined,
    slug: string,
    roleId: string,
    log: CorrelatedLogger,
    req: Request,
    res: Response
  ): boolean {
    const requestId = (req.headers["x-request-id"] as string) || undefined;
    const rawIp =
      typeof req.ip === "string"
        ? req.ip
        : typeof (req.socket as { remoteAddress?: string }).remoteAddress ===
          "string"
        ? (req.socket as { remoteAddress?: string }).remoteAddress!
        : "";
    const ipCidr = truncateIpToCidr(rawIp);

    if (!attendee?.name || !attendee?.email) {
      log.warn("Public registration validation failure", undefined, {
        reason: "missing_attendee_fields",
        requestId,
        ipCidr,
        slug,
        roleId,
      });
      res.status(400).json({
        success: false,
        message: "attendee.name and attendee.email are required",
      });
      try {
        registrationFailureCounter.inc({ reason: "validation" });
      } catch {}
      return false;
    }
    return true;
  }

  /**
   * Validate consent (termsAccepted must be true)
   * Returns false if validation fails (response already sent)
   */
  static validateConsent(
    consent: { termsAccepted?: boolean } | undefined,
    slug: string,
    roleId: string,
    log: CorrelatedLogger,
    req: Request,
    res: Response
  ): boolean {
    const requestId = (req.headers["x-request-id"] as string) || undefined;
    const rawIp =
      typeof req.ip === "string"
        ? req.ip
        : typeof (req.socket as { remoteAddress?: string }).remoteAddress ===
          "string"
        ? (req.socket as { remoteAddress?: string }).remoteAddress!
        : "";
    const ipCidr = truncateIpToCidr(rawIp);

    if (!consent?.termsAccepted) {
      log.warn("Public registration validation failure", undefined, {
        reason: "missing_consent",
        requestId,
        ipCidr,
        slug,
        roleId,
      });
      res
        .status(400)
        .json({ success: false, message: "termsAccepted must be true" });
      try {
        registrationFailureCounter.inc({ reason: "validation" });
      } catch {}
      return false;
    }
    return true;
  }

  /**
   * Validate that role exists in event
   * Returns false if validation fails (response already sent)
   */
  static validateRole(
    targetRole: RoleSnapshot | undefined,
    roleId: string,
    slug: string,
    log: CorrelatedLogger,
    req: Request,
    res: Response
  ): boolean {
    const requestId = (req.headers["x-request-id"] as string) || undefined;
    const rawIp =
      typeof req.ip === "string"
        ? req.ip
        : typeof (req.socket as { remoteAddress?: string }).remoteAddress ===
          "string"
        ? (req.socket as { remoteAddress?: string }).remoteAddress!
        : "";
    const ipCidr = truncateIpToCidr(rawIp);

    if (!targetRole) {
      log.warn("Public registration validation failure", undefined, {
        reason: "role_not_found",
        slug,
        roleId,
        requestId,
        ipCidr,
      });
      res.status(400).json({ success: false, message: "Role not found" });
      try {
        registrationFailureCounter.inc({ reason: "validation" });
      } catch {}
      return false;
    }
    return true;
  }

  /**
   * Validate that role is open to public registration
   * Returns false if validation fails (response already sent)
   */
  static validateRolePublic(
    targetRole: RoleSnapshot,
    roleId: string,
    slug: string,
    log: CorrelatedLogger,
    req: Request,
    res: Response
  ): boolean {
    const requestId = (req.headers["x-request-id"] as string) || undefined;
    const rawIp =
      typeof req.ip === "string"
        ? req.ip
        : typeof (req.socket as { remoteAddress?: string }).remoteAddress ===
          "string"
        ? (req.socket as { remoteAddress?: string }).remoteAddress!
        : "";
    const ipCidr = truncateIpToCidr(rawIp);

    if (!targetRole.openToPublic) {
      log.warn("Public registration validation failure", undefined, {
        reason: "role_not_open",
        slug,
        roleId,
        requestId,
        ipCidr,
      });
      res.status(400).json({
        success: false,
        message: "Role is not open to public registration",
      });
      try {
        registrationFailureCounter.inc({ reason: "role_not_open" });
      } catch {}
      return false;
    }
    return true;
  }
}
