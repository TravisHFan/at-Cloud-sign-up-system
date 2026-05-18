import { Router } from "express";
import AnnualMembershipController from "../controllers/annualMembershipController";
import { authenticate, requireAdmin } from "../middleware/auth";

const router = Router();

router.use(authenticate);

router.get("/", AnnualMembershipController.list);
router.get("/:id", AnnualMembershipController.getById);
router.post("/:id/checkout", AnnualMembershipController.createCheckoutSession);

router.post("/", requireAdmin, AnnualMembershipController.create);
router.put("/:id", requireAdmin, AnnualMembershipController.update);

export default router;
