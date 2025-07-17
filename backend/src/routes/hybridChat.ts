import { Router } from "express";
import { HybridChatController } from "../controllers/hybridChatController";
import { authenticate } from "../middleware/auth";
import rateLimit from "express-rate-limit";

const router = Router();

// Apply authentication to all chat routes
router.use(authenticate);

// Apply rate limiting to chat routes
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each user to 100 chat requests per windowMs
  message: "Too many chat requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each user to 30 messages per minute
  message: "You're sending messages too quickly. Please slow down.",
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(chatLimiter);

// Chat conversation routes
router.get("/conversations", HybridChatController.getConversations);
router.get(
  "/conversations/:partnerId/messages",
  HybridChatController.getConversationMessages
);

// Message routes
router.post("/messages", messageLimiter, HybridChatController.sendMessage);
router.delete("/messages/:messageId", HybridChatController.deleteMessage);

// Search routes
router.get("/search", HybridChatController.searchMessages);

export default router;
