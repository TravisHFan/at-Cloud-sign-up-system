import { Request, Response, Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth";
import { uploadImage, uploadAvatar, getFileUrl } from "../middleware/upload";
import { uploadLimiter } from "../middleware/rateLimiting";

const router = Router();

// POST /api/uploads/image - Generic image upload (for editors, etc.)
router.post(
  "/image",
  authenticate,
  uploadLimiter,
  uploadImage,
  (req: Request, res: Response) => {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No image uploaded" });
    }

    // Build a public URL for the stored image using shared helper
    const url = getFileUrl(req, `images/${req.file.filename}`, {
      absolute: true,
    });

    return res.json({ success: true, data: { url } });
  }
);

// POST /api/uploads/avatar - Avatar upload for admin use (does not update profile)
// This is used by admins to upload avatars for other users
router.post(
  "/avatar",
  authenticate,
  requireAdmin,
  uploadLimiter,
  uploadAvatar,
  (req: Request, res: Response) => {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No avatar uploaded" });
    }

    // Build a public URL for the stored avatar with cache-busting timestamp
    // Note: This does NOT update any user profile - just returns the URL
    const baseAvatarUrl = getFileUrl(req, `avatars/${req.file.filename}`, {
      absolute: true,
    });
    const avatarUrl = `${baseAvatarUrl}?t=${Date.now()}`;

    return res.json({ success: true, data: { avatarUrl } });
  }
);

export default router;
