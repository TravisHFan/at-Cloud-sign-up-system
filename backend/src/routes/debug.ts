import express from "express";
import jwt from "jsonwebtoken";

const router = express.Router();

// Temporary debug endpoint to test JWT verification
router.post("/test-jwt", (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({
        success: false,
        message: "Token required",
      });
      return;
    }

    console.log("🔍 Testing JWT token:", {
      tokenStart: token.substring(0, 20) + "...",
      tokenLength: token.length,
      secretExists: !!process.env.JWT_ACCESS_SECRET,
      secretStart: process.env.JWT_ACCESS_SECRET?.substring(0, 20) + "...",
    });

    // Try to decode header
    const parts = token.split(".");
    const header = JSON.parse(Buffer.from(parts[0], "base64").toString());
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());

    console.log("🔍 JWT Header:", header);
    console.log("🔍 JWT Payload:", payload);

    // Try verification
    const decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET || "your-access-secret-key"
    ) as any;

    res.json({
      success: true,
      message: "Token is valid",
      header,
      payload,
      decoded,
    });
  } catch (error: any) {
    console.error("❌ JWT test failed:", error.message);
    res.status(401).json({
      success: false,
      message: error.message,
      type: error.constructor.name,
    });
  }
});

export default router;
