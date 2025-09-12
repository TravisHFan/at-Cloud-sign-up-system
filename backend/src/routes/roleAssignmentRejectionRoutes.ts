import { Router } from "express";
import {
  validateRoleAssignmentRejection,
  rejectRoleAssignment,
} from "../controllers/roleAssignmentRejectionController";
import { roleAssignmentRejectionLimiter } from "../middleware/rateLimiting";

const router = Router();

// Public token-gated endpoints
router.get(
  "/validate",
  roleAssignmentRejectionLimiter,
  validateRoleAssignmentRejection
);
router.post("/reject", roleAssignmentRejectionLimiter, rejectRoleAssignment);

export default router;
