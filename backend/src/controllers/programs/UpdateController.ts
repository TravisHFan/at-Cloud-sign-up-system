import { Request, Response } from "express";
import mongoose from "mongoose";
import { Program } from "../../models";
import { RoleUtils } from "../../utils/roleUtils";

export default class UpdateController {
  static async update(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ success: false, message: "Authentication required." });
        return;
      }

      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid program ID." });
        return;
      }

      // Fetch the program to check permissions
      const program = await Program.findById(id);
      if (!program) {
        res.status(404).json({ success: false, message: "Program not found." });
        return;
      }

      // Authorization logic:
      // 1. Super Admin and Administrator can edit any program
      // 2. Program creator can edit their own program
      // 3. Mentors assigned to this program can edit it
      const isAdmin = RoleUtils.isAdmin(req.user.role);
      const isCreator =
        program.createdBy &&
        String(program.createdBy) === String(req.user!._id);
      const isMentor =
        program.mentors?.some(
          (mentor: { userId: unknown }) =>
            String(mentor.userId) === String(req.user!._id),
        ) ?? false;

      if (!isAdmin && !isCreator && !isMentor) {
        res.status(403).json({
          success: false,
          message:
            "You do not have permission to edit this program. Only Administrators, the program creator, and assigned mentors can edit programs.",
        });
        return;
      }

      const updated = await Program.findByIdAndUpdate(id, req.body, {
        new: true,
        runValidators: true,
      });
      if (!updated) {
        res.status(404).json({ success: false, message: "Program not found." });
        return;
      }
      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      res
        .status(400)
        .json({ success: false, message: (error as Error).message });
    }
  }
}
