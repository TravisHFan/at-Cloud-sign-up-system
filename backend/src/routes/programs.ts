import { Router } from "express";
import { ProgramController } from "../controllers/programController";
import { authenticate } from "../middleware/auth";

const router = Router();

// Public list and get
router.get("/", ProgramController.list);
router.get("/:id", ProgramController.getById);
router.get("/:id/events", ProgramController.listEvents);

// Authenticated admin-only operations are validated inside controller
router.post("/", authenticate, ProgramController.create);
router.put("/:id", authenticate, ProgramController.update);
router.delete("/:id", authenticate, ProgramController.remove);

export default router;
