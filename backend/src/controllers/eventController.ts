import { Request, Response } from "express";
import {
  Event,
  Registration,
  User,
  IEvent,
  IEventRole,
  IEventParticipant,
} from "../models";
import { RoleUtils, PERMISSIONS, hasPermission } from "../utils/roleUtils";
import { v4 as uuidv4 } from "uuid";
import mongoose from "mongoose";
import { getFileUrl } from "../middleware/upload";
import { EmailService } from "../services/infrastructure/emailService";

// Interface for creating events (matches frontend EventData structure)
interface CreateEventRequest {
  title: string;
  type: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  endTime: string; // HH:MM
  location: string;
  organizer: string;
  organizerDetails?: Array<{
    name: string;
    role: string;
    email: string;
    phone: string;
    avatar?: string;
    gender?: "male" | "female";
  }>;
  hostedBy?: string;
  purpose: string;
  agenda?: string;
  format: string;
  disclaimer?: string;
  roles: Array<{
    name: string;
    description: string;
    maxParticipants: number;
  }>;
  description?: string;
  isHybrid?: boolean;
  zoomLink?: string;
  meetingId?: string;
  passcode?: string;
  requirements?: string;
  materials?: string;
}

// Interface for event signup
interface EventSignupRequest {
  roleId: string;
  notes?: string;
  specialRequirements?: string;
}

export class EventController {
  // Helper method to determine event status based on date and time
  private static getEventStatus(
    eventDate: string,
    eventTime: string,
    eventEndTime: string
  ): "upcoming" | "ongoing" | "completed" {
    const now = new Date();
    const eventStart = new Date(`${eventDate}T${eventTime}`);
    const eventEnd = new Date(`${eventDate}T${eventEndTime}`);

    if (now < eventStart) {
      return "upcoming";
    } else if (now >= eventStart && now <= eventEnd) {
      return "ongoing";
    } else {
      return "completed";
    }
  }

  // Helper method to update event status if needed
  private static async updateEventStatusIfNeeded(event: any): Promise<void> {
    const newStatus = EventController.getEventStatus(
      event.date,
      event.time,
      event.endTime
    );

    if (event.status !== newStatus && event.status !== "cancelled") {
      await Event.findByIdAndUpdate(event._id, { status: newStatus });
      event.status = newStatus; // Update the in-memory object too
    }
  }

  // Batch update all event statuses (can be called periodically)
  static async updateAllEventStatuses(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const events = await Event.find({ status: { $ne: "cancelled" } });
      let updatedCount = 0;

      for (const event of events) {
        const newStatus = EventController.getEventStatus(
          event.date,
          event.time,
          event.endTime
        );

        if (event.status !== newStatus) {
          await Event.findByIdAndUpdate(event._id, { status: newStatus });
          updatedCount++;
        }
      }

      res.status(200).json({
        success: true,
        message: `Updated ${updatedCount} event statuses.`,
        data: { updatedCount },
      });
    } catch (error: any) {
      console.error("Update event statuses error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update event statuses.",
      });
    }
  }

  // Get all events with filtering and pagination
  static async getAllEvents(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        type,
        search,
        sortBy = "date",
        sortOrder = "asc",
      } = req.query;

      const pageNumber = parseInt(page as string);
      const limitNumber = parseInt(limit as string);
      const skip = (pageNumber - 1) * limitNumber;

      // Build filter object (don't filter by status yet if status filtering is requested)
      const filter: any = {};
      const requestedStatus = status;

      // For non-status filters, apply them directly
      if (type) {
        filter.type = type;
      }

      // Text search
      if (search) {
        filter.$text = { $search: search as string };
      }

      // Build sort object
      const sort: any = {};
      sort[sortBy as string] = sortOrder === "desc" ? -1 : 1;

      // Get events with pagination (initially without status filter)
      const events = await Event.find(filter)
        .populate("createdBy", "username firstName lastName avatar")
        .sort(sort)
        .skip(skip)
        .limit(limitNumber);

      // Update event statuses based on current time
      for (const event of events) {
        await EventController.updateEventStatusIfNeeded(event);
      }

      // Now filter by status if requested
      let filteredEvents = events;
      if (requestedStatus) {
        filteredEvents = events.filter(
          (event) => event.status === requestedStatus
        );
      }

      const totalEvents = await Event.countDocuments(filter);
      const totalPages = Math.ceil(totalEvents / limitNumber);

      res.status(200).json({
        success: true,
        data: {
          events: filteredEvents,
          pagination: {
            currentPage: pageNumber,
            totalPages,
            totalEvents,
            hasNext: pageNumber < totalPages,
            hasPrev: pageNumber > 1,
          },
        },
      });
    } catch (error: any) {
      console.error("Get events error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve events.",
      });
    }
  }

  // Get single event by ID
  static async getEventById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid event ID.",
        });
        return;
      }

      const event = await Event.findById(id).populate(
        "createdBy",
        "username firstName lastName avatar role"
      );

      if (!event) {
        res.status(404).json({
          success: false,
          message: "Event not found.",
        });
        return;
      }

      // Update event status based on current time
      await EventController.updateEventStatusIfNeeded(event);

      res.status(200).json({
        success: true,
        data: { event },
      });
    } catch (error: any) {
      console.error("Get event error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve event.",
      });
    }
  }

  // Create new event
  static async createEvent(req: Request, res: Response): Promise<void> {
    try {
      console.log("Received event creation request:", {
        body: req.body,
        headers: req.headers["content-type"],
      });

      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      // Check permissions
      if (!hasPermission(req.user.role, PERMISSIONS.CREATE_EVENT)) {
        res.status(403).json({
          success: false,
          message: "Insufficient permissions to create events.",
        });
        return;
      }

      const eventData: CreateEventRequest = req.body;

      // FIX: Ensure date is a string in YYYY-MM-DD format
      // (JSON parsing sometimes converts date strings to Date objects)
      if (req.body.date && req.body.date instanceof Date) {
        eventData.date = req.body.date.toISOString().split("T")[0];
      }

      // Validate required fields (conditional based on format)
      const baseRequiredFields = [
        "title",
        "type",
        "date",
        "time",
        "endTime",
        "organizer",
        "purpose",
        "format",
        "roles",
      ];

      // Add conditional required fields based on format
      const requiredFields = [...baseRequiredFields];
      if (
        eventData.format === "In-person" ||
        eventData.format === "Hybrid Participation"
      ) {
        requiredFields.push("location");
      }
      if (
        eventData.format === "Online" ||
        eventData.format === "Hybrid Participation"
      ) {
        requiredFields.push("zoomLink");
      }

      const missingFields = requiredFields.filter(
        (field) => !eventData[field as keyof CreateEventRequest]
      );

      if (missingFields.length > 0) {
        res.status(400).json({
          success: false,
          message: `Missing required fields: ${missingFields.join(", ")}`,
        });
        return;
      }

      // Validate roles array
      if (!eventData.roles || eventData.roles.length === 0) {
        res.status(400).json({
          success: false,
          message: "Event must have at least one role.",
        });
        return;
      }

      // Create roles with UUIDs
      const eventRoles: IEventRole[] = eventData.roles.map((role) => ({
        id: uuidv4(),
        name: role.name,
        description: role.description,
        maxParticipants: role.maxParticipants,
        currentSignups: [],
      }));

      // Calculate total slots
      const totalSlots = eventRoles.reduce(
        (sum, role) => sum + role.maxParticipants,
        0
      );

      // Create event
      const event = new Event({
        ...eventData,
        roles: eventRoles,
        totalSlots,
        signedUp: 0,
        createdBy: req.user._id,
        hostedBy: eventData.hostedBy || "@Cloud Marketplace Ministry",
        status: "upcoming",
      });

      await event.save();

      // Send email notifications to all users about the new event
      try {
        // Get all users except the event creator
        const allUsers = await User.find({
          _id: { $ne: req.user._id },
          isVerified: true,
        }).select("email firstName lastName");

        console.log(
          `Sending event creation notifications to ${allUsers.length} users`
        );

        // Send notifications in parallel but don't wait for all to complete
        // to avoid blocking the response
        const emailPromises = allUsers.map((user) =>
          EmailService.sendEventCreatedEmail(
            user.email,
            `${user.firstName} ${user.lastName}`,
            {
              title: eventData.title,
              date: eventData.date,
              time: eventData.time,
              endTime: eventData.endTime,
              location: eventData.location,
              zoomLink: eventData.zoomLink,
              organizer: eventData.organizer,
              purpose: eventData.purpose,
              format: eventData.format,
            }
          ).catch((error) => {
            console.error(
              `Failed to send event notification to ${user.email}:`,
              error
            );
            return false; // Continue with other emails even if one fails
          })
        );

        // Process emails in the background
        Promise.all(emailPromises)
          .then((results) => {
            const successCount = results.filter(
              (result) => result === true
            ).length;
            console.log(
              `Event creation notifications sent: ${successCount}/${allUsers.length} successful`
            );
          })
          .catch((error) => {
            console.error("Error processing event notification emails:", error);
          });
      } catch (emailError) {
        console.error(
          "Error fetching users for event notifications:",
          emailError
        );
        // Don't fail the event creation if email notifications fail
      }

      res.status(201).json({
        success: true,
        message: "Event created successfully!",
        data: { event },
      });
    } catch (error: any) {
      console.error("Create event error:", error);

      if (error.name === "ValidationError") {
        const validationErrors = Object.values(error.errors).map(
          (err: any) => err.message
        );
        res.status(400).json({
          success: false,
          message: "Validation failed.",
          errors: validationErrors,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: "Failed to create event.",
      });
    }
  }

  // Update event
  static async updateEvent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid event ID.",
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const event = await Event.findById(id);

      if (!event) {
        res.status(404).json({
          success: false,
          message: "Event not found.",
        });
        return;
      }

      // Check permissions
      const canEditAnyEvent = hasPermission(
        req.user.role,
        PERMISSIONS.EDIT_ANY_EVENT
      );
      const canEditOwnEvent = hasPermission(
        req.user.role,
        PERMISSIONS.EDIT_OWN_EVENT
      );
      const isOwner =
        event.createdBy.toString() === (req.user._id as any).toString();

      if (!canEditAnyEvent && !(canEditOwnEvent && isOwner)) {
        res.status(403).json({
          success: false,
          message: "Insufficient permissions to edit this event.",
        });
        return;
      }

      // Update event (excluding roles for now to prevent data loss)
      const updateData = { ...req.body };
      delete updateData.roles; // Handle roles separately if needed

      Object.assign(event, updateData);
      await event.save();

      res.status(200).json({
        success: true,
        message: "Event updated successfully!",
        data: { event },
      });
    } catch (error: any) {
      console.error("Update event error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update event.",
      });
    }
  }

  // Delete event
  static async deleteEvent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid event ID.",
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const event = await Event.findById(id);

      if (!event) {
        res.status(404).json({
          success: false,
          message: "Event not found.",
        });
        return;
      }

      // Check permissions
      const canDeleteAnyEvent = hasPermission(
        req.user.role,
        PERMISSIONS.DELETE_ANY_EVENT
      );
      const canDeleteOwnEvent = hasPermission(
        req.user.role,
        PERMISSIONS.DELETE_OWN_EVENT
      );
      const isOwner =
        event.createdBy.toString() === (req.user._id as any).toString();

      if (!canDeleteAnyEvent && !(canDeleteOwnEvent && isOwner)) {
        res.status(403).json({
          success: false,
          message: "Insufficient permissions to delete this event.",
        });
        return;
      }

      // Check if event has participants
      if (event.signedUp > 0) {
        res.status(400).json({
          success: false,
          message:
            "Cannot delete event with registered participants. Please remove all participants first.",
        });
        return;
      }

      await Event.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        message: "Event deleted successfully!",
      });
    } catch (error: any) {
      console.error("Delete event error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete event.",
      });
    }
  }

  // Sign up for event role
  static async signUpForEvent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { roleId, notes, specialRequirements }: EventSignupRequest =
        req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid event ID.",
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      if (!roleId) {
        res.status(400).json({
          success: false,
          message: "Role ID is required.",
        });
        return;
      }

      const event = await Event.findById(id);

      if (!event) {
        res.status(404).json({
          success: false,
          message: "Event not found.",
        });
        return;
      }

      // Check if event is still upcoming
      if (event.status !== "upcoming") {
        res.status(400).json({
          success: false,
          message: "Cannot sign up for this event.",
        });
        return;
      }

      // Get user's current signups for this event
      const userCurrentSignups = event.roles.reduce((count, role) => {
        return (
          count +
          role.currentSignups.filter(
            (signup) =>
              signup.userId.toString() === (req.user!._id as any).toString()
          ).length
        );
      }, 0);

      // Define role limits based on user authorization level
      const getRoleLimit = (authLevel: string): number => {
        switch (authLevel) {
          case "Super Admin":
          case "Administrator":
            return 3;
          case "Leader":
            return 2;
          case "Participant":
          default:
            return 1;
        }
      };

      // Define participant-allowed roles
      const participantAllowedRoles = [
        "Prepared Speaker (on-site)",
        "Prepared Speaker (Zoom)",
        "Common Participant (on-site)",
        "Common Participant (Zoom)",
      ];

      const userRoleLimit = getRoleLimit(req.user.role);

      // Check if user has reached their role limit
      if (userCurrentSignups >= userRoleLimit) {
        res.status(400).json({
          success: false,
          message: `You have reached the maximum number of roles (${userRoleLimit}) allowed for your authorization level (${req.user.role}).`,
        });
        return;
      }

      // Check if role is allowed for Participants
      const targetRole = event.roles.find((role) => role.id === roleId);
      if (!targetRole) {
        res.status(400).json({
          success: false,
          message: "Role not found in this event.",
        });
        return;
      }

      if (
        req.user.role === "Participant" &&
        !participantAllowedRoles.includes(targetRole.name)
      ) {
        res.status(403).json({
          success: false,
          message:
            "You need authorization to sign up for this role. As a Participant, you can only sign up for: Prepared Speaker or Common Participant roles.",
        });
        return;
      }

      // Check if user is already signed up for the specific role
      const isAlreadySignedUpForRole = targetRole.currentSignups.some(
        (signup) =>
          signup.userId.toString() === (req.user!._id as any).toString()
      );

      if (isAlreadySignedUpForRole) {
        res.status(400).json({
          success: false,
          message: "You are already signed up for this role.",
        });
        return;
      }

      // Prepare user data for signup
      const userSignupData: Partial<IEventParticipant> = {
        username: req.user.username,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        systemAuthorizationLevel: req.user.role,
        roleInAtCloud: req.user.roleInAtCloud,
        avatar: req.user.avatar,
        gender: req.user.gender,
        notes,
      };

      // Add user to role
      await event.addUserToRole(req.user._id as any, roleId, userSignupData);

      // Handle registration record - check if there's an existing one first
      const role = event.roles.find((r) => r.id === roleId);
      if (role) {
        // Check for existing registration (including cancelled ones)
        let registration = await Registration.findOne({
          userId: req.user._id,
          eventId: event._id,
          roleId,
        });

        if (registration) {
          // Reactivate existing registration
          registration.status = "active";
          registration.notes = notes || registration.notes;
          registration.specialRequirements =
            specialRequirements || registration.specialRequirements;
          registration.addAuditEntry(
            "registered",
            req.user._id as any,
            "Re-registered for role after previous cancellation"
          );
          await registration.save();
        } else {
          // Create new registration
          registration = new Registration({
            userId: req.user._id,
            eventId: event._id,
            roleId,
            userSnapshot: {
              username: req.user.username,
              firstName: req.user.firstName,
              lastName: req.user.lastName,
              email: req.user.email,
              systemAuthorizationLevel: req.user.role,
              roleInAtCloud: req.user.roleInAtCloud,
              avatar: req.user.avatar,
              gender: req.user.gender,
            },
            eventSnapshot: {
              title: event.title,
              date: event.date,
              time: event.time,
              location: event.location,
              type: event.type,
              roleName: role.name,
              roleDescription: role.description,
            },
            status: "active",
            notes,
            specialRequirements,
            registeredBy: req.user._id,
          });

          await registration.save();
        }
      }

      res.status(200).json({
        success: true,
        message: "Successfully signed up for the event!",
        data: {
          event: await Event.findById(id),
        },
      });
    } catch (error: any) {
      console.error("Event signup error:", error);

      if (
        error.message.includes("already signed up") ||
        error.message.includes("already full")
      ) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: "Failed to sign up for event.",
      });
    }
  }

  // Cancel event signup
  static async cancelSignup(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { roleId } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid event ID.",
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const event = await Event.findById(id);

      if (!event) {
        res.status(404).json({
          success: false,
          message: "Event not found.",
        });
        return;
      }

      // Remove user from role
      await event.removeUserFromRole(req.user._id as any, roleId);

      // Delete registration record
      await Registration.findOneAndDelete({
        userId: req.user._id,
        eventId: event._id,
        roleId,
        status: "active",
      });

      res.status(200).json({
        success: true,
        message: "Successfully cancelled your event signup.",
        data: {
          event: await Event.findById(id),
        },
      });
    } catch (error: any) {
      console.error("Cancel signup error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to cancel signup.",
      });
    }
  }

  // Get user's registered events
  static async getUserEvents(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const { status, includeAll } = req.query;

      // Build filter - if includeAll is true, get all statuses
      const filter: any = { userId: req.user._id };
      if (!includeAll && status) {
        filter.status = status;
      } else if (!includeAll) {
        filter.status = "active"; // Default to active only
      }

      // Get user's registrations with populated event data
      const registrations = await Registration.find(filter)
        .populate({
          path: "eventId",
          select:
            "title date time endTime location format status type organizer createdAt",
        })
        .sort({ registrationDate: -1 }); // Most recent first

      // Categorize events and enhance with current status
      const now = new Date();
      const events = registrations
        .filter((reg) => reg.eventId) // Only include registrations with valid events
        .map((reg) => {
          const event = reg.eventId as any;
          const eventDateTime = new Date(
            `${event.date}T${event.endTime || event.time}`
          );
          const isPassedEvent = eventDateTime < now;

          return {
            event: {
              id: event._id,
              title: event.title,
              date: event.date,
              time: event.time,
              endTime: event.endTime,
              location: event.location,
              format: event.format,
              status: event.status,
              type: event.type,
              organizer: event.organizer,
              createdAt: event.createdAt,
            },
            registration: {
              id: reg._id,
              roleId: reg.roleId,
              roleName: reg.eventSnapshot.roleName,
              roleDescription: reg.eventSnapshot.roleDescription,
              registrationDate: reg.registrationDate,
              status: reg.status,
              notes: reg.notes,
              specialRequirements: reg.specialRequirements,
            },
            // Add computed properties for frontend
            isPassedEvent,
            eventStatus: isPassedEvent ? "passed" : "upcoming",
          };
        });

      // Provide summary statistics
      const stats = {
        total: events.length,
        upcoming: events.filter((e) => !e.isPassedEvent).length,
        passed: events.filter((e) => e.isPassedEvent).length,
        active: events.filter((e) => e.registration.status === "active").length,
      };

      res.status(200).json({
        success: true,
        data: {
          events,
          stats,
        },
      });
    } catch (error: any) {
      console.error("Get user events error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve user events.",
      });
    }
  }

  // Get events created by user
  static async getCreatedEvents(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const events = await Event.find({ createdBy: req.user._id }).sort({
        createdAt: -1,
      });

      res.status(200).json({
        success: true,
        data: { events },
      });
    } catch (error: any) {
      console.error("Get created events error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve created events.",
      });
    }
  }

  // Get event participants (for event organizers and admins)
  static async getEventParticipants(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          success: false,
          message: "Invalid event ID.",
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const event = await Event.findById(id);

      if (!event) {
        res.status(404).json({
          success: false,
          message: "Event not found.",
        });
        return;
      }

      // Check permissions
      const canViewParticipants = hasPermission(
        req.user.role,
        PERMISSIONS.MODERATE_EVENT_PARTICIPANTS
      );
      const isOwner =
        event.createdBy.toString() === (req.user._id as any).toString();

      if (!canViewParticipants && !isOwner) {
        res.status(403).json({
          success: false,
          message: "Insufficient permissions to view participants.",
        });
        return;
      }

      // Get detailed registrations
      const registrations = await Registration.find({
        eventId: id,
        status: "active",
      }).populate("userId", "username firstName lastName email avatar role");

      res.status(200).json({
        success: true,
        data: {
          event: {
            id: event._id,
            title: event.title,
            roles: event.roles,
          },
          registrations,
        },
      });
    } catch (error: any) {
      console.error("Get event participants error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve event participants.",
      });
    }
  }

  // Upload event image
  static async uploadEventImage(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
        return;
      }

      const { id: eventId } = req.params;

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: "No file uploaded.",
        });
        return;
      }

      // Find the event
      const event = await Event.findById(eventId);
      if (!event) {
        res.status(404).json({
          success: false,
          message: "Event not found.",
        });
        return;
      }

      // Check if user can edit this event
      const canEdit =
        hasPermission(req.user.role, PERMISSIONS.EDIT_ANY_EVENT) ||
        event.organizer === req.user.username;

      if (!canEdit) {
        res.status(403).json({
          success: false,
          message: "Insufficient permissions to edit this event.",
        });
        return;
      }

      // Generate image URL
      const imageUrl = getFileUrl(req, `events/${req.file.filename}`);

      // Update event image
      (event as any).image = imageUrl;
      await event.save();

      res.status(200).json({
        success: true,
        message: "Event image uploaded successfully.",
        data: { imageUrl },
      });
    } catch (error: any) {
      console.error("Upload event image error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to upload event image.",
      });
    }
  }
}
