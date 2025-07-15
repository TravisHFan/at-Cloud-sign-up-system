import { Router } from "express";
import { RefactoredMessageController } from "../controllers/RefactoredMessageController";
import { MessageController } from "../controllers/messageController"; // Keep some existing methods
import { authenticate } from "../middleware/auth";

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// ✅ NEW: Improved message endpoints
router.get("/", RefactoredMessageController.getMessages); // Handles all cases including user's all messages
router.post("/", RefactoredMessageController.sendMessage); // Enhanced with notifications

// ✅ NEW: Direct conversation endpoints
router.get("/conversations", RefactoredMessageController.getUserConversations); // Get conversation list
router.get(
  "/conversations/:userId",
  RefactoredMessageController.getDirectConversation
); // Get specific conversation

// Keep existing functionality for other features
router.patch("/:messageId", MessageController.editMessage);
router.delete("/:messageId", MessageController.deleteMessage);
router.post("/:messageId/reactions", MessageController.addReaction);

// Chat room functionality (unchanged)
router.get("/chat-rooms", MessageController.getChatRooms);
router.post("/chat-rooms", MessageController.createChatRoom);

// File upload (unchanged)
router.post("/upload", MessageController.uploadAttachment);

export default router;
