import { Request, Response } from "express";
import RolesTemplate, {
  IRolesTemplate,
  ITemplateRole,
} from "../models/RolesTemplate";
import { IUser } from "../models/User";
import { hasPermission, PERMISSIONS } from "../utils/roleUtils";
import { CorrelatedLogger } from "../services/CorrelatedLogger";
import mongoose from "mongoose";

interface CreateTemplateRequest {
  name: string;
  eventType: string;
  roles: ITemplateRole[];
}

interface UpdateTemplateRequest {
  name?: string;
  roles?: ITemplateRole[];
}

export class RolesTemplateController {
  /**
   * Get all role templates, grouped by event type
   * GET /api/roles-templates
   *
   * Returns:
   * {
   *   "Conference": [{ _id, name, roles, createdBy, createdAt, updatedAt }],
   *   "Webinar": [...],
   *   ...
   * }
   */
  static async getAllTemplates(req: Request, res: Response): Promise<void> {
    try {
      const templates = await RolesTemplate.find()
        .populate("createdBy", "firstName lastName username avatar")
        .sort({ eventType: 1, createdAt: 1 })
        .lean();

      // Group templates by event type
      const groupedTemplates: Record<string, any[]> = {};
      for (const template of templates) {
        const eventType = template.eventType;
        if (!groupedTemplates[eventType]) {
          groupedTemplates[eventType] = [];
        }
        groupedTemplates[eventType].push(template);
      }

      res.status(200).json({
        success: true,
        data: groupedTemplates,
      });
    } catch (error) {
      CorrelatedLogger.fromRequest(req, "RolesTemplateController").error(
        "Failed to fetch role templates",
        error as Error
      );
      res.status(500).json({
        success: false,
        message: "Failed to fetch role templates",
      });
    }
  }

  /**
   * Get templates for a specific event type
   * GET /api/roles-templates/event-type/:eventType
   */
  static async getTemplatesByEventType(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { eventType } = req.params;

      const templates = await RolesTemplate.find({ eventType })
        .populate("createdBy", "firstName lastName username avatar")
        .sort({ createdAt: 1 })
        .lean();

      res.status(200).json({
        success: true,
        data: templates,
      });
    } catch (error) {
      CorrelatedLogger.fromRequest(req, "RolesTemplateController").error(
        "Failed to fetch templates by event type",
        error as Error
      );
      res.status(500).json({
        success: false,
        message: "Failed to fetch templates",
      });
    }
  }

  /**
   * Get a single template by ID
   * GET /api/roles-templates/:id
   */
  static async getTemplateById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid template ID",
        });
        return;
      }

      const template = await RolesTemplate.findById(id)
        .populate("createdBy", "firstName lastName username avatar")
        .lean();

      if (!template) {
        res.status(404).json({
          success: false,
          message: "Template not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: template,
      });
    } catch (error) {
      CorrelatedLogger.fromRequest(req, "RolesTemplateController").error(
        "Failed to fetch template by ID",
        error as Error
      );
      res.status(500).json({
        success: false,
        message: "Failed to fetch template",
      });
    }
  }

  /**
   * Create a new role template
   * POST /api/roles-templates
   *
   * Permissions: Super Admin, Administrator, Leader
   */
  static async createTemplate(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user as IUser | undefined;
      if (!user) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      // Check permission: Super Admin, Administrator, or Leader
      if (
        !hasPermission(user.role, PERMISSIONS.CREATE_EVENT) &&
        user.role !== "Leader"
      ) {
        res.status(403).json({
          success: false,
          message: "Insufficient permissions to create role templates",
        });
        return;
      }

      const { name, eventType, roles } = req.body as CreateTemplateRequest;

      // Validation
      if (!name || !name.trim()) {
        res.status(400).json({
          success: false,
          message: "Template name is required",
        });
        return;
      }

      if (!eventType || !eventType.trim()) {
        res.status(400).json({
          success: false,
          message: "Event type is required",
        });
        return;
      }

      if (!Array.isArray(roles) || roles.length === 0) {
        res.status(400).json({
          success: false,
          message: "At least one role is required",
        });
        return;
      }

      // Validate roles
      for (const role of roles) {
        if (!role.name || !role.name.trim()) {
          res.status(400).json({
            success: false,
            message: "Role name is required for all roles",
          });
          return;
        }
        if (!role.description || !role.description.trim()) {
          res.status(400).json({
            success: false,
            message: "Role description is required for all roles",
          });
          return;
        }
        if (
          typeof role.maxParticipants !== "number" ||
          role.maxParticipants < 1
        ) {
          res.status(400).json({
            success: false,
            message: "Role maxParticipants must be a positive number",
          });
          return;
        }
      }

      // Create template
      const newTemplate = await RolesTemplate.create({
        name: name.trim(),
        eventType: eventType.trim(),
        roles,
        createdBy: user._id,
      });

      // Populate creator info for response
      await newTemplate.populate(
        "createdBy",
        "firstName lastName username avatar"
      );

      res.status(201).json({
        success: true,
        message: "Role template created successfully",
        data: newTemplate,
      });
    } catch (error) {
      CorrelatedLogger.fromRequest(req, "RolesTemplateController").error(
        "Failed to create role template",
        error as Error
      );
      res.status(500).json({
        success: false,
        message: "Failed to create role template",
      });
    }
  }

  /**
   * Update an existing role template
   * PUT /api/roles-templates/:id
   *
   * Permissions: Super Admin, Administrator, or Template Creator
   */
  static async updateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user as IUser | undefined;
      if (!user) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid template ID",
        });
        return;
      }

      const template = await RolesTemplate.findById(id);

      if (!template) {
        res.status(404).json({
          success: false,
          message: "Template not found",
        });
        return;
      }

      // Check permission: Super Admin, Administrator, or Creator
      const isCreator = template.createdBy.toString() === String(user._id);
      const isAdmin =
        hasPermission(user.role, PERMISSIONS.MANAGE_USERS) ||
        user.role === "Administrator";

      if (!isCreator && !isAdmin) {
        res.status(403).json({
          success: false,
          message: "You can only edit templates you created",
        });
        return;
      }

      const { name, roles } = req.body as UpdateTemplateRequest;

      // Validate updates
      if (name !== undefined) {
        if (!name.trim()) {
          res.status(400).json({
            success: false,
            message: "Template name cannot be empty",
          });
          return;
        }
        template.name = name.trim();
      }

      if (roles !== undefined) {
        if (!Array.isArray(roles) || roles.length === 0) {
          res.status(400).json({
            success: false,
            message: "At least one role is required",
          });
          return;
        }

        // Validate roles
        for (const role of roles) {
          if (!role.name || !role.name.trim()) {
            res.status(400).json({
              success: false,
              message: "Role name is required for all roles",
            });
            return;
          }
          if (!role.description || !role.description.trim()) {
            res.status(400).json({
              success: false,
              message: "Role description is required for all roles",
            });
            return;
          }
          if (
            typeof role.maxParticipants !== "number" ||
            role.maxParticipants < 1
          ) {
            res.status(400).json({
              success: false,
              message: "Role maxParticipants must be a positive number",
            });
            return;
          }
        }

        template.roles = roles;
      }

      await template.save();
      await template.populate(
        "createdBy",
        "firstName lastName username avatar"
      );

      res.status(200).json({
        success: true,
        message: "Role template updated successfully",
        data: template,
      });
    } catch (error) {
      CorrelatedLogger.fromRequest(req, "RolesTemplateController").error(
        "Failed to update role template",
        error as Error
      );
      res.status(500).json({
        success: false,
        message: "Failed to update role template",
      });
    }
  }

  /**
   * Delete a role template
   * DELETE /api/roles-templates/:id
   *
   * Permissions: Super Admin, Administrator, or Template Creator
   * Shows warning for confirmation
   */
  static async deleteTemplate(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user as IUser | undefined;
      if (!user) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid template ID",
        });
        return;
      }

      const template = await RolesTemplate.findById(id);

      if (!template) {
        res.status(404).json({
          success: false,
          message: "Template not found",
        });
        return;
      }

      // Check permission: Super Admin, Administrator, or Creator
      const isCreator = template.createdBy.toString() === String(user._id);
      const isAdmin =
        hasPermission(user.role, PERMISSIONS.MANAGE_USERS) ||
        user.role === "Administrator";

      if (!isCreator && !isAdmin) {
        res.status(403).json({
          success: false,
          message: "You can only delete templates you created",
        });
        return;
      }

      // Delete the template
      await RolesTemplate.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        message: "Role template deleted successfully",
      });
    } catch (error) {
      CorrelatedLogger.fromRequest(req, "RolesTemplateController").error(
        "Failed to delete role template",
        error as Error
      );
      res.status(500).json({
        success: false,
        message: "Failed to delete role template",
      });
    }
  }
}
