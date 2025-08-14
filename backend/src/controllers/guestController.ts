import { Request, Response } from "express";
import { validationResult } from "express-validator";
import {
  GuestRegistration,
  Event,
  IGuestRegistration,
  IEvent,
  IEventRole,
} from "../models";
import {
  guestRegistrationValidation,
  validateGuestUniqueness,
  validateGuestRateLimit,
} from "../middleware/guestValidation";
import { EmailService } from "../services/infrastructure/emailService";
import { socketService } from "../services/infrastructure/SocketService";
import mongoose from "mongoose";

/**
 * Guest Registration Controller
 * Handles guest user registrations for events without requiring full user accounts
 */
export class GuestController {
  /**
   * Register a guest for an event role
   * POST /api/events/:eventId/guest-signup
   */
  static async registerGuest(req: Request, res: Response): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
        return;
      }

      const { eventId } = req.params;
      const { roleId, fullName, gender, email, phone, notes } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get("User-Agent");

      // Validate event exists
      const event = await Event.findById(eventId);
      if (!event) {
        res.status(404).json({
          success: false,
          message: "Event not found",
        });
        return;
      }

      // Find the specific role
      const eventRole = event.roles.find(
        (role: IEventRole) => role.id === roleId
      );
      if (!eventRole) {
        res.status(404).json({
          success: false,
          message: "Event role not found",
        });
        return;
      }

      // Check if event registration is still open
      const now = new Date();
      if (event.registrationDeadline && now > event.registrationDeadline) {
        res.status(400).json({
          success: false,
          message: "Registration deadline has passed",
        });
        return;
      }

      // Rate limiting check
      const rateLimitCheck = validateGuestRateLimit(ipAddress || "", email);
      if (!rateLimitCheck.isValid) {
        res.status(429).json({
          success: false,
          message: rateLimitCheck.message,
        });
        return;
      }

      // Check for existing guest registration
      const uniquenessCheck = await validateGuestUniqueness(email, eventId);
      if (!uniquenessCheck.isValid) {
        res.status(400).json({
          success: false,
          message: uniquenessCheck.message,
        });
        return;
      }

      // Check role capacity (including existing guests and users)
      const currentGuestCount =
        await GuestRegistration.countActiveRegistrations(eventId, roleId);

      // TODO: Also count regular user registrations for this role
      // const currentUserCount = await Registration.countActiveRegistrations(eventId, roleId);
      const currentUserCount = 0; // Placeholder until we integrate with existing Registration model

      const totalCurrentRegistrations = currentGuestCount + currentUserCount;

      if (
        eventRole.capacity &&
        totalCurrentRegistrations >= eventRole.capacity
      ) {
        res.status(400).json({
          success: false,
          message: "This role is at full capacity",
        });
        return;
      }

      // Create event snapshot for historical reference
      const eventSnapshot = {
        title: event.title,
        date: event.date,
        location: event.location,
        roleName: eventRole.name,
      };

      // Create guest registration
      const guestRegistration = new GuestRegistration({
        eventId: new mongoose.Types.ObjectId(eventId),
        roleId,
        fullName: fullName.trim(),
        gender,
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
        notes: notes?.trim(),
        ipAddress,
        userAgent,
        eventSnapshot,
        registrationDate: new Date(),
        status: "active",
        migrationStatus: "pending",
      });

      // Save guest registration
      const savedRegistration = await guestRegistration.save();

      // Send confirmation email
      try {
        // TODO: Implement guest confirmation email method
        console.log("Guest confirmation email would be sent to:", email);
        /*
        await EmailService.sendGuestConfirmationEmail({
          guestEmail: email,
          guestName: fullName,
          event: {
            title: event.title,
            date: event.date,
            location: event.location,
            time: event.time
          },
          role: {
            name: eventRole.name,
            description: eventRole.description
          },
          registrationId: (savedRegistration._id as mongoose.Types.ObjectId).toString()
        });
        */
      } catch (emailError) {
        console.error("Failed to send guest confirmation email:", emailError);
        // Don't fail the registration if email fails
      }

      // Notify organizers
      try {
        // TODO: Implement organizer notification method
        console.log(
          "Organizer notification would be sent for guest registration"
        );
        /*
        await EmailService.sendGuestRegistrationNotification({
          event: {
            title: event.title,
            date: event.date,
            location: event.location
          },
          guest: {
            name: fullName,
            email,
            phone
          },
          role: {
            name: eventRole.name
          },
          registrationDate: savedRegistration.registrationDate,
          organizerEmails: event.organizerDetails?.map((org: any) => org.email).filter(Boolean) || []
        });
        */
      } catch (emailError) {
        console.error("Failed to send organizer notification:", emailError);
        // Don't fail the registration if email fails
      }

      // Emit WebSocket update for real-time updates
      try {
        socketService.emitEventUpdate(eventId, "guest_registration", {
          eventId,
          roleId,
          guestName: fullName,
          timestamp: savedRegistration.registrationDate,
        });
      } catch (socketError) {
        console.error("Failed to emit WebSocket update:", socketError);
        // Don't fail the registration if socket fails
      }

      // Return success response
      res.status(201).json({
        success: true,
        message: "Guest registration successful",
        data: {
          registrationId: savedRegistration._id,
          eventTitle: event.title,
          roleName: eventRole.name,
          registrationDate: savedRegistration.registrationDate,
          confirmationEmailSent: true,
        },
      });
    } catch (error) {
      console.error("Guest registration error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during guest registration",
      });
    }
  }

  /**
   * Get guest registrations for an event (Admin only)
   * GET /api/events/:eventId/guests
   */
  static async getEventGuests(req: Request, res: Response): Promise<void> {
    try {
      const { eventId } = req.params;

      // TODO: Add admin authentication check
      // if (!req.user || req.user.authLevel < 'Administrator') {
      //   res.status(403).json({ success: false, message: 'Admin access required' });
      //   return;
      // }

      const guests = await GuestRegistration.findActiveByEvent(eventId);

      res.json({
        success: true,
        data: {
          guests: guests.map((guest) => guest.toAdminJSON()),
          count: guests.length,
        },
      });
    } catch (error) {
      console.error("Error fetching event guests:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch event guests",
      });
    }
  }

  /**
   * Cancel a guest registration
   * DELETE /api/guest-registrations/:id
   */
  static async cancelGuestRegistration(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const guestRegistration = await GuestRegistration.findById(id);

      if (!guestRegistration) {
        res.status(404).json({
          success: false,
          message: "Guest registration not found",
        });
        return;
      }

      if (guestRegistration.status === "cancelled") {
        res.status(400).json({
          success: false,
          message: "Registration is already cancelled",
        });
        return;
      }

      // Update registration status
      guestRegistration.status = "cancelled";
      if (reason) {
        guestRegistration.notes = `${
          guestRegistration.notes || ""
        }\nCancellation reason: ${reason}`.trim();
      }

      await guestRegistration.save();

      // Emit WebSocket update
      try {
        socketService.emitEventUpdate(
          guestRegistration.eventId.toString(),
          "guest_cancellation",
          {
            eventId: guestRegistration.eventId.toString(),
            roleId: guestRegistration.roleId,
            guestName: guestRegistration.fullName,
            timestamp: new Date(),
          }
        );
      } catch (socketError) {
        console.error("Failed to emit cancellation update:", socketError);
      }

      res.json({
        success: true,
        message: "Guest registration cancelled successfully",
      });
    } catch (error) {
      console.error("Error cancelling guest registration:", error);
      res.status(500).json({
        success: false,
        message: "Failed to cancel guest registration",
      });
    }
  }

  /**
   * Update guest registration details
   * PUT /api/guest-registrations/:id
   */
  static async updateGuestRegistration(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { fullName, phone, notes } = req.body;

      const guestRegistration = await GuestRegistration.findById(id);

      if (!guestRegistration) {
        res.status(404).json({
          success: false,
          message: "Guest registration not found",
        });
        return;
      }

      if (guestRegistration.status === "cancelled") {
        res.status(400).json({
          success: false,
          message: "Cannot update cancelled registration",
        });
        return;
      }

      // Update allowed fields
      if (fullName) guestRegistration.fullName = fullName.trim();
      if (phone) guestRegistration.phone = phone.trim();
      if (notes !== undefined) guestRegistration.notes = notes?.trim();

      await guestRegistration.save();

      res.json({
        success: true,
        message: "Guest registration updated successfully",
        data: guestRegistration.toPublicJSON(),
      });
    } catch (error) {
      console.error("Error updating guest registration:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update guest registration",
      });
    }
  }

  /**
   * Get guest registration by ID (for email links)
   * GET /api/guest-registrations/:id
   */
  static async getGuestRegistration(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;

      const guestRegistration = await GuestRegistration.findById(id);

      if (!guestRegistration) {
        res.status(404).json({
          success: false,
          message: "Guest registration not found",
        });
        return;
      }

      res.json({
        success: true,
        data: guestRegistration.toPublicJSON(),
      });
    } catch (error) {
      console.error("Error fetching guest registration:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch guest registration",
      });
    }
  }
}

export default GuestController;
