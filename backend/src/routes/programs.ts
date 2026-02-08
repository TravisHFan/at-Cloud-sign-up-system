import { Router, Request, Response } from "express";
import { ProgramController } from "../controllers/programController";
import { authenticate, authenticateOptional } from "../middleware/auth";
import { EmailService } from "../services/infrastructure/EmailServiceFacade";
import { EmailRecipientUtils } from "../utils/emailRecipientUtils";
import { Program } from "../models";
import mongoose from "mongoose";

const router = Router();

// Public list and get (with optional auth for contact info filtering)
router.get("/", ProgramController.list);
router.get("/:id", authenticateOptional, ProgramController.getById);
router.get("/:id/events", ProgramController.listEvents);
router.get(
  "/:id/participants",
  authenticateOptional,
  ProgramController.getParticipants,
);

// Authenticated admin-only operations are validated inside controller
router.post("/", authenticate, ProgramController.create);
router.put("/:id", authenticate, ProgramController.update);
router.delete("/:id", authenticate, ProgramController.remove);

// Admin enrollment operations
router.post("/:id/admin-enroll", authenticate, ProgramController.adminEnroll);
router.delete(
  "/:id/admin-enroll",
  authenticate,
  ProgramController.adminUnenroll,
);

// Email all participants (mentors, class reps, mentees) - authenticated
router.post("/:id/email", authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      subject,
      bodyHtml,
      bodyText,
      includeMentors = true,
      includeClassReps = true,
      includeMentees = true,
    } = req.body || {};

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid program ID" });
      return;
    }

    if (!subject || !bodyHtml) {
      res.status(400).json({
        success: false,
        message: "Subject and bodyHtml are required",
      });
      return;
    }

    // Load program to verify it exists and get mentor info for reply-to
    const program = await Program.findById(id).populate<{
      mentors?: Array<{
        userId?:
          | mongoose.Types.ObjectId
          | { email?: string; firstName?: string; lastName?: string };
      }>;
    }>("mentors.userId", "email firstName lastName");

    if (!program) {
      res.status(404).json({ success: false, message: "Program not found" });
      return;
    }

    // Check authorization: user must be:
    // 1. Super Admin or Administrator, OR
    // 2. Leader who is a Mentor or Class Rep of this program
    const user = req.user as { id?: string; role?: string } | undefined;
    const isAdmin =
      user?.role === "Super Admin" || user?.role === "Administrator";
    const isLeader = user?.role === "Leader";

    // Check if user is a mentor
    const isMentor =
      program.mentors?.some((m: { userId?: unknown }) => {
        const mentorUserId = m.userId;
        if (!mentorUserId) return false;
        // Handle both ObjectId and populated user object
        let mentorId: string;
        if (
          typeof mentorUserId === "object" &&
          mentorUserId !== null &&
          "_id" in mentorUserId
        ) {
          mentorId = String((mentorUserId as { _id: unknown })._id);
        } else {
          mentorId = String(mentorUserId);
        }
        return mentorId === user?.id;
      }) ?? false;

    // Check if user is a class rep (via purchase or admin enrollment)
    let isClassRep = false;
    if (isLeader && user?.id && !isMentor) {
      const Purchase = (await import("../models/Purchase")).default;
      const classRepPurchase = await Purchase.findOne({
        programId: id,
        userId: user.id,
        isClassRep: true,
        status: "completed",
      });
      if (classRepPurchase) {
        isClassRep = true;
      } else {
        // Also check admin enrollments for class reps
        isClassRep =
          program.adminEnrollments?.classReps?.some(
            (crId: unknown) => String(crId) === user.id,
          ) ?? false;
      }
    }

    // Authorization check
    const canSendEmail = isAdmin || (isLeader && (isMentor || isClassRep));
    if (!canSendEmail) {
      res.status(403).json({
        success: false,
        message:
          "You must be an admin, or a Leader who is a mentor/class rep of this program to send emails",
      });
      return;
    }

    // Determine Reply-To (first mentor if available)
    let replyTo: string | undefined;
    if (program.mentors && program.mentors.length > 0) {
      const firstMentor = program.mentors[0];
      if (firstMentor.userId && typeof firstMentor.userId === "object") {
        const mentorUser = firstMentor.userId as {
          email?: string;
          firstName?: string;
          lastName?: string;
        };
        if (mentorUser.email) {
          const name =
            [mentorUser.firstName, mentorUser.lastName]
              .filter(Boolean)
              .join(" ") || "Mentor";
          replyTo = `${name} <${mentorUser.email}>`;
        }
      }
    }

    // Gather recipients
    const recipients = await EmailRecipientUtils.getProgramParticipants(id, {
      includeMentors,
      includeClassReps,
      includeMentees,
    });

    // Dedupe by email
    const seen = new Set<string>();
    const unique = recipients.filter((r) => {
      const key = r.email.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (unique.length === 0) {
      res.status(200).json({
        success: true,
        message: "No recipients found",
        recipientCount: 0,
        sent: 0,
      });
      return;
    }

    // Send emails
    const results = await Promise.allSettled(
      unique.map((r) =>
        EmailService.sendEmail({
          to: r.email,
          subject,
          html: bodyHtml,
          text: bodyText,
          replyTo,
        }),
      ),
    );

    const sent = results.filter(
      (x) => x.status === "fulfilled" && x.value === true,
    ).length;

    res.status(200).json({
      success: true,
      message: `Email sent to ${sent}/${unique.length} recipients`,
      recipientCount: unique.length,
      sent,
    });
  } catch (error) {
    console.error("Failed to send program emails:", error);
    res.status(500).json({ success: false, message: "Failed to send emails" });
  }
});

export default router;
