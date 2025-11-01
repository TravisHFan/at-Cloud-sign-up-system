import { Request, Response } from "express";

export class ProgramController {
  static async create(req: Request, res: Response): Promise<void> {
    const { default: CreationController } = await import(
      "./programs/CreationController"
    );
    return CreationController.create(req, res);
  }

  /**
   * Retrieves all events linked to a specific program
   *
   * @route GET /programs/:id/events
   * @param req.params.id - Program ObjectId (required)
   * @returns {Object} Success response with events array sorted by date/time
   * @example
   * // Response format
   * {
   *   "success": true,
   *   "data": [
   *     {
   *       "_id": "event123",
   *       "title": "Event Title",
   *       "date": "2025-01-15",
   *       "time": "10:00",
   *       "programId": "program123",
   *       // ... other event fields
   *     }
   *   ]
   * }
   * @throws {400} Invalid program ID format
   * @throws {500} Database error during retrieval
   */
  static async listEvents(req: Request, res: Response): Promise<void> {
    const { default: EventListController } = await import(
      "./programs/EventListController"
    );
    return EventListController.listEvents(req, res);
  }

  static async list(req: Request, res: Response): Promise<void> {
    const { default: ListController } = await import(
      "./programs/ListController"
    );
    return ListController.list(req, res);
  }

  static async getById(req: Request, res: Response): Promise<void> {
    const { default: RetrievalController } = await import(
      "./programs/RetrievalController"
    );
    return RetrievalController.getById(req, res);
  }

  static async update(req: Request, res: Response): Promise<void> {
    const { default: UpdateController } = await import(
      "./programs/UpdateController"
    );
    return UpdateController.update(req, res);
  }

  /**
   * Deletes a program with optional cascade deletion of linked events
   *
   * @route DELETE /programs/:id?deleteLinkedEvents=true|false
   * @param req.params.id - Program ObjectId (required)
   * @param req.query.deleteLinkedEvents - Boolean flag for cascade deletion (optional, default: false)
   * @security Requires Administrator or Super Admin role
   * @returns {Object} Success response with deletion details
   *
   * @example
   * // Unlink-only mode (deleteLinkedEvents=false or omitted)
   * {
   *   "success": true,
   *   "message": "Program deleted. Unlinked 3 related events.",
   *   "unlinkedEvents": 3
   * }
   *
   * @example
   * // Cascade mode (deleteLinkedEvents=true)
   * {
   *   "success": true,
   *   "message": "Program and 3 events deleted with cascades.",
   *   "deletedEvents": 3,
   *   "deletedRegistrations": 15,
   *   "deletedGuestRegistrations": 8
   * }
   *
   * @throws {401} Authentication required
   * @throws {403} Only Administrators can delete programs
   * @throws {400} Invalid program ID format
   * @throws {500} Database error during deletion
   */
  /**
   * Deletes a program with optional cascade deletion of linked events
   *
   * @route DELETE /programs/:id?deleteLinkedEvents=true|false
   * @param req.params.id - Program ObjectId (required)
   * @param req.query.deleteLinkedEvents - Boolean flag for cascade deletion (optional, default: false)
   * @security Requires Administrator or Super Admin role
   * @returns {Object} Success response with deletion details
   *
   * @example
   * // Unlink-only mode (deleteLinkedEvents=false or omitted)
   * {
   *   "success": true,
   *   "message": "Program deleted. Unlinked 3 related events.",
   *   "unlinkedEvents": 3
   * }
   *
   * @example
   * // Cascade mode (deleteLinkedEvents=true)
   * {
   *   "success": true,
   *   "message": "Program and 3 events deleted with cascades.",
   *   "deletedEvents": 3,
   *   "deletedRegistrations": 15,
   *   "deletedGuestRegistrations": 8
   * }
   *
   * @throws {401} Authentication required
   * @throws {403} Only Administrators can delete programs
   * @throws {400} Invalid program ID format
   * @throws {500} Database error during deletion
   */
  static async remove(req: Request, res: Response): Promise<void> {
    const { default: DeletionController } = await import(
      "./programs/DeletionController"
    );
    return DeletionController.remove(req, res);
  }

  /**
   * Get all participants (mentees and class reps) for a program
   * Combines paid purchases and admin enrollments
   *
   * @route GET /programs/:id/participants
   * @returns {Object} Lists of mentees and classReps with user info and enrollment metadata
   */
  static async getParticipants(req: Request, res: Response): Promise<void> {
    const { default: ParticipantsController } = await import(
      "./programs/ParticipantsController"
    );
    return ParticipantsController.getParticipants(req, res);
  }

  /**
   * Admin enrollment - allows Super Admin & Administrator to enroll as mentee or class rep
   *
   * @route POST /programs/:id/admin-enroll
   * @body { enrollAs: 'mentee' | 'classRep' }
   * @returns {Object} Updated program with admin enrollment
   */
  static async adminEnroll(req: Request, res: Response): Promise<void> {
    const { default: AdminEnrollController } = await import(
      "./programs/AdminEnrollController"
    );
    return AdminEnrollController.adminEnroll(req, res);
  }

  /**
   * Admin unenrollment - removes admin from mentee or class rep list
   *
   * @route DELETE /programs/:id/admin-enroll
   * @returns {Object} Updated program without admin enrollment
   */
  static async adminUnenroll(req: Request, res: Response): Promise<void> {
    const { default: AdminUnenrollController } = await import(
      "./programs/AdminUnenrollController"
    );
    return AdminUnenrollController.adminUnenroll(req, res);
  }
}
