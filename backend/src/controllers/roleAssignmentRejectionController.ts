import { Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import { verifyRoleAssignmentRejectionToken } from "../utils/roleAssignmentRejectionToken";
import Registration, { IRegistration } from "../models/Registration";
import Event from "../models/Event";
import { TrioNotificationService } from "../services/notifications/TrioNotificationService";
import { RejectionMetricsService } from "../services/RejectionMetricsService";
import User from "../models/User";
import { socketService } from "../services/infrastructure/SocketService";

function gone(res: Response, code = "ASSIGNMENT_REJECTION_TOKEN_INVALID") {
  return res.status(410).json({ success: false, code });
}

export async function validateRoleAssignmentRejection(
  req: Request,
  res: Response
) {
  const token = String(req.query.token || "");
  if (!token) {
    RejectionMetricsService.increment("invalid");
    return gone(res);
  }
  const result = verifyRoleAssignmentRejectionToken(token);
  if (!result.valid) {
    RejectionMetricsService.increment(
      result.reason === "expired" ? "expired" : "invalid"
    );
    return gone(res);
  }
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

  // Fetch event timeZone (not stored in snapshot currently)
  let timeZone: string | undefined;
  try {
    const evDoc = await Event.findById(reg.eventId)
      .select("timeZone")
      .lean<{ _id: Types.ObjectId; timeZone?: string } | null>();
    if (evDoc && !Array.isArray(evDoc)) {
      timeZone = evDoc.timeZone;
    }
  } catch {
    // silent: timeZone optional
  }
  const eventInfo = {
    id: String(reg.eventId),
    title: reg.eventSnapshot?.title,
    date: reg.eventSnapshot?.date,
    time: reg.eventSnapshot?.time,
    roleName: reg.eventSnapshot?.roleName,
    timeZone,
  };
  return res.json({
    success: true,
    event: eventInfo,
    role: eventInfo.roleName,
  });
}

export async function rejectRoleAssignment(req: Request, res: Response) {
  const { token, note } = req.body || {};
  if (!token) {
    RejectionMetricsService.increment("invalid");
    return gone(res);
  }
  if (!note || typeof note !== "string" || !note.trim()) {
    RejectionMetricsService.increment("note_missing");
    return res.status(400).json({ success: false, code: "NOTE_REQUIRED" });
  }
  const trimmedNote = note.trim().slice(0, 1000);
  const result = verifyRoleAssignmentRejectionToken(token);
  if (!result.valid) {
    RejectionMetricsService.increment(
      result.reason === "expired" ? "expired" : "invalid"
    );
    return gone(res);
  }
  const { assignmentId, assigneeId } = result.payload;
  if (
    !mongoose.isValidObjectId(assignmentId) ||
    !mongoose.isValidObjectId(assigneeId)
  ) {
    return gone(res);
  }
  const reg: IRegistration | null = await Registration.findById(assignmentId);
  if (!reg) {
    RejectionMetricsService.increment("replay");
    return gone(res, "ASSIGNMENT_ALREADY_REMOVED");
  }
  if (String(reg.userId) !== assigneeId) {
    RejectionMetricsService.increment("invalid");
    return gone(res);
  }

  await reg.deleteOne();

  // Real-time event update (notify event page listeners)
  try {
    socketService.emitEventUpdate(String(reg.eventId), "role_rejected", {
      roleName: reg.eventSnapshot?.roleName,
      userId: assigneeId,
      registrationId: assignmentId,
      noteProvided: Boolean(trimmedNote),
    });
  } catch (_rtErr) {
    // swallow in controller path; logging not critical for test env
  }

  // Attempt to emit real-time/system notification to assigner (if we can infer assigner)
  // NOTE: Current Registration schema does not persist the assigning actor explicitly.
  // We fall back to event creator as assigner candidate (imperfect but improves visibility) until
  // a dedicated assignment actor is stored.
  try {
    const eventCreatorId =
      (reg as unknown as { registeredBy?: Types.ObjectId }).registeredBy ||
      reg.userId; // registeredBy stored as user performing signup/assignment
    // Avoid notifying the user who rejected themselves as the assigner (common self-signup case)
    if (String(eventCreatorId) !== String(assigneeId)) {
      type LeanUser = {
        _id: Types.ObjectId;
        firstName?: string;
        lastName?: string;
        username?: string;
        email: string;
        avatar?: string;
        gender?: string;
        role?: string;
        roleInAtCloud?: string;
      };
      const assignerUser =
        (await User.findById(eventCreatorId).lean<LeanUser | null>()) || null;
      const rejectingUser =
        (await User.findById(assigneeId).lean<LeanUser | null>()) || null;
      if (assignerUser) {
        await TrioNotificationService.createEventRoleAssignmentRejectedTrio({
          event: {
            id: String(reg.eventId),
            title: reg.eventSnapshot?.title || "Event",
          },
          targetUser: {
            id: assigneeId,
            firstName: rejectingUser?.firstName,
            lastName: rejectingUser?.lastName,
          },
          roleName: reg.eventSnapshot?.roleName || "Role",
          assigner: {
            id: String(assignerUser._id),
            firstName: assignerUser.firstName,
            lastName: assignerUser.lastName,
            username: assignerUser.username,
            avatar: assignerUser.avatar,
            gender: assignerUser.gender,
            authLevel: assignerUser.role,
            roleInAtCloud: assignerUser.roleInAtCloud,
          },
          noteProvided: Boolean(trimmedNote),
          assignerEmail: assignerUser.email,
          noteText: trimmedNote,
        });
      }
    }
  } catch (notifyError) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("Failed to emit rejection notification", notifyError);
    }
  }

  RejectionMetricsService.increment("success");
  return res.json({ success: true, status: "rejected" });
}
