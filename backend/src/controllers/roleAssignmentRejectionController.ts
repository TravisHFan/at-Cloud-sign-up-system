import { Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import { verifyRoleAssignmentRejectionToken } from "../utils/roleAssignmentRejectionToken";
import Registration, { IRegistration } from "../models/Registration";

function gone(res: Response, code = "ASSIGNMENT_REJECTION_TOKEN_INVALID") {
  return res.status(410).json({ success: false, code });
}

export async function validateRoleAssignmentRejection(
  req: Request,
  res: Response
) {
  const token = String(req.query.token || "");
  if (!token) return gone(res);
  const result = verifyRoleAssignmentRejectionToken(token);
  if (!result.valid) return gone(res);
  const { assignmentId, assigneeId } = result.payload;
  if (
    !mongoose.isValidObjectId(assignmentId) ||
    !mongoose.isValidObjectId(assigneeId)
  ) {
    return gone(res);
  }
  const reg = await Registration.findById(assignmentId).lean<
    Pick<IRegistration, "userId" | "eventId" | "eventSnapshot"> & {
      _id: Types.ObjectId;
    }
  >();
  if (!reg) return gone(res);
  if (String(reg.userId) !== assigneeId) return gone(res);

  const eventInfo = {
    id: String(reg.eventId),
    title: reg.eventSnapshot?.title,
    date: reg.eventSnapshot?.date,
    time: reg.eventSnapshot?.time,
    roleName: reg.eventSnapshot?.roleName,
  };
  return res.json({
    success: true,
    event: eventInfo,
    role: eventInfo.roleName,
  });
}

export async function rejectRoleAssignment(req: Request, res: Response) {
  const { token, note } = req.body || {};
  if (!token) return gone(res);
  if (!note || typeof note !== "string" || !note.trim()) {
    return res.status(400).json({ success: false, code: "NOTE_REQUIRED" });
  }
  const trimmedNote = note.trim().slice(0, 1000);
  const result = verifyRoleAssignmentRejectionToken(token);
  if (!result.valid) return gone(res);
  const { assignmentId, assigneeId } = result.payload;
  if (
    !mongoose.isValidObjectId(assignmentId) ||
    !mongoose.isValidObjectId(assigneeId)
  ) {
    return gone(res);
  }
  const reg: IRegistration | null = await Registration.findById(assignmentId);
  if (!reg) return gone(res, "ASSIGNMENT_ALREADY_REMOVED");
  if (String(reg.userId) !== assigneeId) return gone(res);

  await reg.deleteOne();

  // Placeholder for real-time + system notification emission (Task 5.5)
  if (process.env.NODE_ENV !== "test") {
    console.log("role_assignment_rejected", {
      assignmentId,
      eventId: String(reg.eventId),
      userId: assigneeId,
      noteLength: trimmedNote.length,
    });
  }

  return res.json({ success: true, status: "rejected" });
}
