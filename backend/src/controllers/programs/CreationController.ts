import { Request, Response } from "express";
import { Program } from "../../models";
import { RoleUtils } from "../../utils/roleUtils";

export default class CreationController {
  static async create(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }
      if (!RoleUtils.isAdmin(req.user.role)) {
        res.status(403).json({
          success: false,
          message: "Only Administrators can create programs.",
        });
        return;
      }

      const payload = req.body || {};
      const doc = await Program.create({ ...payload, createdBy: req.user._id });
      res.status(201).json({ success: true, data: doc });
    } catch (error) {
      res
        .status(400)
        .json({ success: false, message: (error as Error).message });
    }
  }
}
