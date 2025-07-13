import { Router } from "express";
import { SearchController } from "../controllers/searchController";
import { authenticate } from "../middleware/auth";

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Search users
router.get("/users", SearchController.searchUsers);

// Search events
router.get("/events", SearchController.searchEvents);

// Global search (users and events)
router.get("/global", SearchController.globalSearch);

export default router;
