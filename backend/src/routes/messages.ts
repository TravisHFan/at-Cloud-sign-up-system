import { Router } from "express";
import { RefactoredMessageController } from "../controllers/messageController";
import { authenticate } from "../middleware/auth";

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Main message endpoints
router.get("/", RefactoredMessageController.getMessages);
router.post("/", RefactoredMessageController.sendMessage);

// Conversation endpoints
router.get("/conversations", RefactoredMessageController.getUserConversations);
router.get(
  "/conversations/:userId",
  RefactoredMessageController.getDirectConversation
);

// Message management (if these methods exist)
// router.patch("/:messageId", RefactoredMessageController.editMessage);
// router.delete("/:messageId", RefactoredMessageController.deleteMessage);
// router.post("/:messageId/reactions", RefactoredMessageController.addReaction);

// Chat room functionality (if these methods exist)
// router.get("/chat-rooms", RefactoredMessageController.getChatRooms);
// router.post("/chat-rooms", RefactoredMessageController.createChatRoom);

// File upload (if this method exists)
// router.post("/upload", RefactoredMessageController.uploadAttachment);

export default router;
