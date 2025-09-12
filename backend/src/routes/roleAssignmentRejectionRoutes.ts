import { Router } from "express";
import {
  validateRoleAssignmentRejection,
  rejectRoleAssignment,
} from "../controllers/roleAssignmentRejectionController";

const router = Router();

// Public token-gated endpoints
router.get("/validate", validateRoleAssignmentRejection);
router.post("/reject", rejectRoleAssignment);

export default router;
