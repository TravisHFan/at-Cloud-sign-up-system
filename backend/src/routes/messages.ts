import { Router } from "express";
import { MessageController } from "../controllers/messageController";
import { authenticate } from "../middleware/auth";
import { uploadAttachment } from "../middleware/upload";
import {
  validateMessage,
  validateObjectId,
  handleValidationErrors,
} from "../middleware/validation";
import { uploadLimiter } from "../middleware/rateLimiting";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Message routes
router.get("/", MessageController.getMessages);
router.post(
  "/",
  validateMessage,
  handleValidationErrors,
  MessageController.sendMessage
);
router.put(
  "/:messageId",
  validateObjectId,
  validateMessage,
  handleValidationErrors,
  MessageController.editMessage
);
router.delete(
  "/:messageId",
  validateObjectId,
  handleValidationErrors,
  MessageController.deleteMessage
);
router.post(
  "/:messageId/reactions",
  validateObjectId,
  handleValidationErrors,
  MessageController.addReaction
);

// Chat room routes
router.get("/chat-rooms", MessageController.getChatRooms);
router.post("/chat-rooms", MessageController.createChatRoom);

// Attachment upload route
router.post(
  "/attachments",
  uploadLimiter,
  uploadAttachment,
  MessageController.uploadAttachment
);

export default router;
