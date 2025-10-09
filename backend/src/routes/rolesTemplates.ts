import { Router } from "express";
import { RolesTemplateController } from "../controllers/rolesTemplateController";
import { authenticate, requireLeader } from "../middleware/auth";

const router = Router();

/**
 * Role Templates Routes
 *
 * All routes require authentication
 * - GET routes: Any authenticated user
 * - POST: Super Admin, Administrator, Leader
 * - PUT/DELETE: Super Admin, Administrator, or Template Creator
 */

// Get all templates grouped by event type
router.get("/", authenticate, RolesTemplateController.getAllTemplates);

// Get templates for a specific event type
router.get(
  "/event-type/:eventType",
  authenticate,
  RolesTemplateController.getTemplatesByEventType
);

// Get a single template by ID
router.get("/:id", authenticate, RolesTemplateController.getTemplateById);

// Create a new template (Super Admin, Administrator, Leader)
router.post("/", authenticate, RolesTemplateController.createTemplate);

// Update a template (Super Admin, Administrator, or Creator)
router.put("/:id", authenticate, RolesTemplateController.updateTemplate);

// Delete a template (Super Admin, Administrator, or Creator)
router.delete("/:id", authenticate, RolesTemplateController.deleteTemplate);

export default router;
