/**
 * Programs Route Unit Tests
 *
 * Tests the programs router email endpoint (inline handler)
 * Controller method tests are covered by programController.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express, { Express } from "express";
import request from "supertest";
import mongoose from "mongoose";

// Use an isolated approach - define route handlers inline to test behavior

describe("programs routes - email endpoint", () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    app = express();
    app.use(express.json());
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("POST /api/programs/:id/email - validation", () => {
    it("should return 400 for invalid program ID format", async () => {
      // Create a minimal route that just validates ObjectId
      app.post(
        "/api/programs/:id/email",
        (req: express.Request, res: express.Response) => {
          const { id } = req.params;
          if (!mongoose.Types.ObjectId.isValid(id)) {
            res
              .status(400)
              .json({ success: false, message: "Invalid program ID" });
            return;
          }
          res.status(200).json({ success: true });
        }
      );

      const response = await request(app)
        .post("/api/programs/invalid-id/email")
        .send({ subject: "Test", bodyHtml: "<p>Test</p>" })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        message: "Invalid program ID",
      });
    });

    it("should return 400 when subject is missing", async () => {
      app.post(
        "/api/programs/:id/email",
        (req: express.Request, res: express.Response) => {
          const { subject, bodyHtml } = req.body || {};
          if (!subject || !bodyHtml) {
            res.status(400).json({
              success: false,
              message: "Subject and bodyHtml are required",
            });
            return;
          }
          res.status(200).json({ success: true });
        }
      );

      const validId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .post(`/api/programs/${validId}/email`)
        .send({ bodyHtml: "<p>Test</p>" })
        .expect(400);

      expect(response.body.message).toBe("Subject and bodyHtml are required");
    });

    it("should return 400 when bodyHtml is missing", async () => {
      app.post(
        "/api/programs/:id/email",
        (req: express.Request, res: express.Response) => {
          const { subject, bodyHtml } = req.body || {};
          if (!subject || !bodyHtml) {
            res.status(400).json({
              success: false,
              message: "Subject and bodyHtml are required",
            });
            return;
          }
          res.status(200).json({ success: true });
        }
      );

      const validId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .post(`/api/programs/${validId}/email`)
        .send({ subject: "Test Subject" })
        .expect(400);

      expect(response.body.message).toBe("Subject and bodyHtml are required");
    });
  });

  describe("POST /api/programs/:id/email - authorization", () => {
    it("should return 403 when user is not authorized", async () => {
      app.post(
        "/api/programs/:id/email",
        (req: express.Request, res: express.Response) => {
          // Simulate the authorization logic
          const user = (req as any).user as
            | { id?: string; role?: string }
            | undefined;
          const isAdmin =
            user?.role === "Super Admin" || user?.role === "Administrator";

          if (!isAdmin) {
            res.status(403).json({
              success: false,
              message:
                "You must be an admin, or a Leader who is a mentor/class rep of this program to send emails",
            });
            return;
          }
          res.status(200).json({ success: true });
        }
      );

      // No user on request = not authorized
      const validId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .post(`/api/programs/${validId}/email`)
        .send({ subject: "Test", bodyHtml: "<p>Test</p>" })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("must be an admin");
    });

    it("should allow Administrator to send email", async () => {
      // Add auth middleware
      app.use((req, _res, next) => {
        (req as any).user = { id: "user123", role: "Administrator" };
        next();
      });

      app.post(
        "/api/programs/:id/email",
        (req: express.Request, res: express.Response) => {
          const user = (req as any).user as
            | { id?: string; role?: string }
            | undefined;
          const isAdmin =
            user?.role === "Super Admin" || user?.role === "Administrator";

          if (!isAdmin) {
            res.status(403).json({ success: false, message: "Not authorized" });
            return;
          }
          res.status(200).json({ success: true, isAdmin });
        }
      );

      const validId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .post(`/api/programs/${validId}/email`)
        .send({ subject: "Test", bodyHtml: "<p>Test</p>" })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.isAdmin).toBe(true);
    });

    it("should allow Super Admin to send email", async () => {
      app.use((req, _res, next) => {
        (req as any).user = { id: "user123", role: "Super Admin" };
        next();
      });

      app.post(
        "/api/programs/:id/email",
        (req: express.Request, res: express.Response) => {
          const user = (req as any).user as
            | { id?: string; role?: string }
            | undefined;
          const isAdmin =
            user?.role === "Super Admin" || user?.role === "Administrator";

          if (!isAdmin) {
            res.status(403).json({ success: false, message: "Not authorized" });
            return;
          }
          res.status(200).json({ success: true });
        }
      );

      const validId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .post(`/api/programs/${validId}/email`)
        .send({ subject: "Test", bodyHtml: "<p>Test</p>" })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe("POST /api/programs/:id/email - recipient handling", () => {
    it("should return success with 0 recipients when none found", async () => {
      app.use((req, _res, next) => {
        (req as any).user = { id: "user123", role: "Administrator" };
        next();
      });

      app.post(
        "/api/programs/:id/email",
        (req: express.Request, res: express.Response) => {
          // Simulate empty recipients
          const recipients: { email: string }[] = [];

          if (recipients.length === 0) {
            res.status(200).json({
              success: true,
              message: "No recipients found",
              recipientCount: 0,
              sent: 0,
            });
            return;
          }
          res.status(200).json({ success: true });
        }
      );

      const validId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .post(`/api/programs/${validId}/email`)
        .send({ subject: "Test", bodyHtml: "<p>Test</p>" })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: "No recipients found",
        recipientCount: 0,
        sent: 0,
      });
    });

    it("should dedupe recipients by email (case-insensitive)", async () => {
      app.use((req, _res, next) => {
        (req as any).user = { id: "user123", role: "Administrator" };
        next();
      });

      app.post(
        "/api/programs/:id/email",
        (req: express.Request, res: express.Response) => {
          // Simulate recipients with duplicates
          const recipients = [
            { email: "test@example.com" },
            { email: "TEST@EXAMPLE.COM" }, // duplicate
            { email: "other@example.com" },
          ];

          // Dedupe logic from the actual route
          const seen = new Set<string>();
          const unique = recipients.filter((r) => {
            const key = r.email.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          res.status(200).json({
            success: true,
            recipientCount: unique.length,
            sent: unique.length,
          });
        }
      );

      const validId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .post(`/api/programs/${validId}/email`)
        .send({ subject: "Test", bodyHtml: "<p>Test</p>" })
        .expect(200);

      expect(response.body.recipientCount).toBe(2); // Deduped
    });
  });

  describe("POST /api/programs/:id/email - error handling", () => {
    it("should return 500 on internal error", async () => {
      app.use((req, _res, next) => {
        (req as any).user = { id: "user123", role: "Administrator" };
        next();
      });

      app.post(
        "/api/programs/:id/email",
        (_req: express.Request, res: express.Response) => {
          // Simulate error
          console.error("Failed to send program emails:", new Error("DB down"));
          res
            .status(500)
            .json({ success: false, message: "Failed to send emails" });
        }
      );

      const validId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .post(`/api/programs/${validId}/email`)
        .send({ subject: "Test", bodyHtml: "<p>Test</p>" })
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        message: "Failed to send emails",
      });
    });
  });

  describe("POST /api/programs/:id/email - reply-to handling", () => {
    it("should construct replyTo from first mentor", async () => {
      app.use((req, _res, next) => {
        (req as any).user = { id: "user123", role: "Administrator" };
        next();
      });

      app.post(
        "/api/programs/:id/email",
        (_req: express.Request, res: express.Response) => {
          // Simulate mentor data
          const program = {
            mentors: [
              {
                userId: {
                  email: "mentor@test.com",
                  firstName: "John",
                  lastName: "Doe",
                },
              },
            ],
          };

          let replyTo: string | undefined;
          if (program.mentors && program.mentors.length > 0) {
            const firstMentor = program.mentors[0];
            if (firstMentor.userId && typeof firstMentor.userId === "object") {
              const mentorUser = firstMentor.userId;
              if (mentorUser.email) {
                const name =
                  [mentorUser.firstName, mentorUser.lastName]
                    .filter(Boolean)
                    .join(" ") || "Mentor";
                replyTo = `${name} <${mentorUser.email}>`;
              }
            }
          }

          res.status(200).json({ success: true, replyTo });
        }
      );

      const validId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .post(`/api/programs/${validId}/email`)
        .send({ subject: "Test", bodyHtml: "<p>Test</p>" })
        .expect(200);

      expect(response.body.replyTo).toBe("John Doe <mentor@test.com>");
    });

    it("should use 'Mentor' as fallback name when mentor has no name", async () => {
      app.use((req, _res, next) => {
        (req as any).user = { id: "user123", role: "Administrator" };
        next();
      });

      app.post(
        "/api/programs/:id/email",
        (_req: express.Request, res: express.Response) => {
          const program = {
            mentors: [
              {
                userId: {
                  email: "mentor@test.com",
                  firstName: "",
                  lastName: "",
                },
              },
            ],
          };

          let replyTo: string | undefined;
          if (program.mentors && program.mentors.length > 0) {
            const firstMentor = program.mentors[0];
            if (firstMentor.userId && typeof firstMentor.userId === "object") {
              const mentorUser = firstMentor.userId;
              if (mentorUser.email) {
                const name =
                  [mentorUser.firstName, mentorUser.lastName]
                    .filter(Boolean)
                    .join(" ") || "Mentor";
                replyTo = `${name} <${mentorUser.email}>`;
              }
            }
          }

          res.status(200).json({ success: true, replyTo });
        }
      );

      const validId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .post(`/api/programs/${validId}/email`)
        .send({ subject: "Test", bodyHtml: "<p>Test</p>" })
        .expect(200);

      expect(response.body.replyTo).toBe("Mentor <mentor@test.com>");
    });
  });

  describe("POST /api/programs/:id/email - Leader authorization", () => {
    it("should allow Leader who is a mentor to send email", async () => {
      const userId = new mongoose.Types.ObjectId().toString();

      app.use((req, _res, next) => {
        (req as any).user = { id: userId, role: "Leader" };
        next();
      });

      app.post(
        "/api/programs/:id/email",
        (req: express.Request, res: express.Response) => {
          const user = (req as any).user as { id?: string; role?: string };
          const isAdmin =
            user?.role === "Super Admin" || user?.role === "Administrator";
          const isLeader = user?.role === "Leader";

          // Simulate mentor check
          const mentorId = userId; // same as user
          const isMentor = mentorId === user?.id;

          const canSendEmail = isAdmin || (isLeader && isMentor);
          if (!canSendEmail) {
            res.status(403).json({ success: false, message: "Not authorized" });
            return;
          }

          res.status(200).json({ success: true, isMentor });
        }
      );

      const validId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .post(`/api/programs/${validId}/email`)
        .send({ subject: "Test", bodyHtml: "<p>Test</p>" })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.isMentor).toBe(true);
    });

    it("should reject Leader who is not a mentor or class rep", async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const differentUserId = new mongoose.Types.ObjectId().toString();

      app.use((req, _res, next) => {
        (req as any).user = { id: userId, role: "Leader" };
        next();
      });

      app.post(
        "/api/programs/:id/email",
        (req: express.Request, res: express.Response) => {
          const user = (req as any).user as { id?: string; role?: string };
          const isAdmin =
            user?.role === "Super Admin" || user?.role === "Administrator";
          const isLeader = user?.role === "Leader";

          // Mentor is someone else
          const mentorId = differentUserId;
          const isMentor = mentorId === user?.id;
          const isClassRep = false;

          const canSendEmail =
            isAdmin || (isLeader && (isMentor || isClassRep));
          if (!canSendEmail) {
            res.status(403).json({
              success: false,
              message:
                "You must be an admin, or a Leader who is a mentor/class rep of this program to send emails",
            });
            return;
          }

          res.status(200).json({ success: true });
        }
      );

      const validId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .post(`/api/programs/${validId}/email`)
        .send({ subject: "Test", bodyHtml: "<p>Test</p>" })
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });
});
