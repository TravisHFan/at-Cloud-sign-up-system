import { Router } from "express";
import { MessageController } from "../controllers/messageController";
import { authenticate } from "../middleware/auth";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Message routes
router.get("/", MessageController.getMessages);
router.post("/", MessageController.sendMessage);
router.put("/:messageId", MessageController.editMessage);
router.delete("/:messageId", MessageController.deleteMessage);
router.post("/:messageId/reactions", MessageController.addReaction);

// Chat room routes
router.get("/chat-rooms", MessageController.getChatRooms);
router.post("/chat-rooms", MessageController.createChatRoom);

export default router;
