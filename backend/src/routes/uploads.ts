import { Request, Response, Router } from "express";
import { authenticate } from "../middleware/auth";
import { uploadImage, getFileUrl } from "../middleware/upload";
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

export default router;
