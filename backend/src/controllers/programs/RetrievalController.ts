import { Request, Response } from "express";
import mongoose from "mongoose";
import { Program } from "../../models";

export default class RetrievalController {
  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid program ID." });
        return;
      }
      const program = await Program.findById(id);
      if (!program) {
        res.status(404).json({ success: false, message: "Program not found." });
        return;
      }
      res.status(200).json({ success: true, data: program });
    } catch {
      res
        .status(500)
        .json({ success: false, message: "Failed to get program." });
    }
  }
}
