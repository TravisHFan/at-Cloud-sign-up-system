import { Router } from "express";
import { authenticate } from "../middleware/auth";
import RefundRequestController from "../controllers/refundRequestController";

const router = Router();

router.use(authenticate);

router.get("/:id", RefundRequestController.getById);
router.post("/:id/approve", RefundRequestController.approve);
router.post("/:id/reject", RefundRequestController.reject);
router.post("/:id/user-decision", RefundRequestController.userDecision);

export default router;
