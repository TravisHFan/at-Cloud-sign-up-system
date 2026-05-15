import { Request, Response } from "express";
import { RefundRequestService } from "../services/RefundRequestService";

const ADMIN_ROLES = ["Super Admin", "Administrator"];

export default class RefundRequestController {
  static async getById(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }

      const request = await RefundRequestService.getRequestForUser(
        req.params.id,
        req.user,
      );

      if (!request) {
        res.status(404).json({
          success: false,
          message: "Refund request not found or no longer available.",
        });
        return;
      }

      res.status(200).json({ success: true, data: request });
    } catch (error) {
      console.error("Error loading refund request:", error);
      res.status(500).json({
        success: false,
        message: "Failed to load refund request.",
      });
    }
  }

  static async approve(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }

      if (!ADMIN_ROLES.includes(req.user.role)) {
        res.status(403).json({
          success: false,
          message: "Only administrators can approve refund requests.",
        });
        return;
      }

      const result = await RefundRequestService.approve(req.params.id, req.user);

      if (!result.ok) {
        if (
          (result.reason === "already_decided" ||
            result.reason === "expired") &&
          result.request
        ) {
          res.status(200).json({
            success: true,
            message:
              result.reason === "expired"
                ? "This refund request has expired."
                : "This request has already been answered.",
            data: result.request,
          });
          return;
        }

        const status =
          result.reason === "not_found"
            ? 404
            : 400;

        res.status(status).json({
          success: false,
          message:
            result.reason === "already_decided"
              ? "This request has already been answered."
              : result.reason === "expired"
                ? "This refund request has expired."
                : result.reason === "purchase_missing"
                  ? "The related purchase could not be found."
                  : result.message || "Could not approve this refund request.",
          data: result.request,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Refund request approved.",
        data: result.request,
      });
    } catch (error) {
      console.error("Error approving refund request:", error);
      res.status(500).json({
        success: false,
        message: "Failed to approve refund request.",
      });
    }
  }

  static async reject(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }

      if (!ADMIN_ROLES.includes(req.user.role)) {
        res.status(403).json({
          success: false,
          message: "Only administrators can reject refund requests.",
        });
        return;
      }

      const note =
        typeof req.body?.note === "string" ? req.body.note.trim() : undefined;
      const result = await RefundRequestService.reject(
        req.params.id,
        req.user,
        note,
      );

      if (!result.ok) {
        if (
          (result.reason === "already_decided" ||
            result.reason === "expired") &&
          result.request
        ) {
          res.status(200).json({
            success: true,
            message:
              result.reason === "expired"
                ? "This refund request has expired."
                : "This request has already been answered.",
            data: result.request,
          });
          return;
        }

        const status =
          result.reason === "not_found"
            ? 404
            : 400;

        res.status(status).json({
          success: false,
          message:
            result.reason === "already_decided"
              ? "This request has already been answered."
              : result.reason === "expired"
                ? "This refund request has expired."
                : "Could not reject this refund request.",
          data: result.request,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Refund request rejected.",
        data: result.request,
      });
    } catch (error) {
      console.error("Error rejecting refund request:", error);
      res.status(500).json({
        success: false,
        message: "Failed to reject refund request.",
      });
    }
  }

  static async userDecision(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }

      const decision = req.body?.decision;
      if (
        decision !== "unenroll_without_refund" &&
        decision !== "stay_enrolled"
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid decision.",
        });
        return;
      }

      const result = await RefundRequestService.recordUserDecision(
        req.params.id,
        req.user,
        decision,
      );

      if (!result.ok) {
        if (
          (result.reason === "already_decided" ||
            result.reason === "not_waiting_for_user") &&
          result.request
        ) {
          res.status(200).json({
            success: true,
            message:
              result.reason === "already_decided"
                ? "You already answered this request."
                : "This request is not waiting for your decision.",
            data: result.request,
          });
          return;
        }

        const status =
          result.reason === "not_found"
            ? 404
            : result.reason === "forbidden"
              ? 403
              : 400;

        res.status(status).json({
          success: false,
          message:
            result.reason === "forbidden"
              ? "You do not have permission to answer this request."
              : result.reason === "already_decided"
                ? "You already answered this request."
                : result.reason === "not_waiting_for_user"
                  ? "This request is not waiting for your decision."
                  : "Could not save your decision.",
          data: result.request,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Your decision has been saved.",
        data: result.request,
      });
    } catch (error) {
      console.error("Error saving refund request user decision:", error);
      res.status(500).json({
        success: false,
        message: "Failed to save your decision.",
      });
    }
  }
}
