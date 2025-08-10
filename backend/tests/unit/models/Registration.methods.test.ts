import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";
import Registration from "../../../src/models/Registration";

function buildDoc(overrides: Partial<any> = {}) {
  const base = {
    userId: new mongoose.Types.ObjectId(),
    eventId: new mongoose.Types.ObjectId(),
    roleId: "r1",
    userSnapshot: {
      username: "user1",
      firstName: "U",
      lastName: "One",
      email: "u1@example.com",
    },
    eventSnapshot: {
      title: "Test Event",
      date: "2025-12-31",
      time: "12:00",
      location: "Main Hall",
      type: "In-person",
      roleName: "Helper",
      roleDescription: "Helps",
    },
    status: "active",
    registeredBy: new mongoose.Types.ObjectId(),
    notes: "old",
  };
  const doc: any = new (Registration as any)({ ...base, ...overrides });
  // stub save to avoid DB IO and allow method to proceed
  doc.save = vi.fn().mockResolvedValue(doc);
  return doc;
}

describe("Registration instance methods", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("updateNotes updates notes, pushes audit, and saves", async () => {
    const updater = new mongoose.Types.ObjectId();
    const doc: any = buildDoc();

    await doc.updateNotes("new-notes", updater);

    expect(doc.notes).toBe("new-notes");
    expect(doc.save).toHaveBeenCalledTimes(1);
    expect(doc.actionHistory.length).toBeGreaterThan(0);
    const last = doc.actionHistory[doc.actionHistory.length - 1];
    expect(last.action).toBe("updated_notes");
    expect(last.performedBy.toString()).toBe(updater.toString());
  });

  it("changeRole updates roleId and roleName and saves", async () => {
    const changer = new mongoose.Types.ObjectId();
    const doc: any = buildDoc({
      roleId: "r1",
      eventSnapshot: { ...buildDoc().eventSnapshot, roleName: "Old" },
    });

    await doc.changeRole("r2", "New Role", changer);

    expect(doc.roleId).toBe("r2");
    expect(doc.eventSnapshot.roleName).toBe("New Role");
    expect(doc.save).toHaveBeenCalledTimes(1);
    const last = doc.actionHistory[doc.actionHistory.length - 1];
    expect(last.action).toBe("role_changed");
  });

  it("confirmAttendance throws when status is not active", async () => {
    const confirmer = new mongoose.Types.ObjectId();
    const doc: any = buildDoc({ status: "waitlisted" });

    await expect(doc.confirmAttendance(confirmer)).rejects.toThrow(
      /only confirm attendance for active/i
    );
    // ensure no save called on error path
    expect(doc.save).not.toHaveBeenCalled();
  });
});
