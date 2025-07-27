import { Request, Response } from "express";
import { Event, Registration, User, IEvent, IEventRole } from "../models";
import { RoleUtils, PERMISSIONS, hasPermission } from "../utils/roleUtils";
import { v4 as uuidv4 } from "uuid";
import mongoose from "mongoose";
import { getFileUrl } from "../middleware/upload";
import { EmailService } from "../services/infrastructure/emailService";
import { socketService } from "../services/infrastructure/SocketService";
import { RegistrationQueryService } from "../services/RegistrationQueryService";
import { ResponseBuilderService } from "../services/ResponseBuilderService";

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

  // Helper method to populate fresh organizer contact information
  private static async populateFreshOrganizerContacts(
    organizerDetails: any[]
  ): Promise<any[]> {
    if (!organizerDetails || organizerDetails.length === 0) {
      return [];
    }

    return Promise.all(
      organizerDetails.map(async (organizer: any) => {
        if (organizer.userId) {
          // Get fresh contact info from User collection
          const user = await User.findById(organizer.userId).select(
            "email phone firstName lastName avatar"
          );
          if (user) {
            return {
              ...organizer.toObject(),
              email: user.email, // Always fresh from User collection
              phone: user.phone || "Phone not provided", // Always fresh
              name: `${user.firstName} ${user.lastName}`, // Ensure name is current
              avatar: user.avatar || organizer.avatar, // Use latest avatar
            };
          }
        }
        // If no userId or user not found, return stored data
        return organizer.toObject();
      })
    );
  }

  // Batch update all event statuses (can be called periodically)
  static async updateAllEventStatuses(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const updatedCount = await EventController.updateAllEventStatusesHelper();

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

  // Helper method to update all event statuses without sending response
  private static async updateAllEventStatusesHelper(): Promise<number> {
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

    return updatedCount;
  }

  // Recalculate signup counts for all events
  static async recalculateSignupCounts(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const updatedCount =
        await EventController.recalculateSignupCountsHelper();

      res.status(200).json({
        success: true,
        message: `Recalculated signup counts for ${updatedCount} events.`,
        data: { updatedCount },
      });
    } catch (error: any) {
      console.error("Recalculate signup counts error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to recalculate signup counts.",
      });
    }
  }

  // Helper method to recalculate signup counts for all events
  private static async recalculateSignupCountsHelper(): Promise<number> {
    const events = await Event.find({});
    let updatedCount = 0;

    for (const event of events) {
      const currentSignedUp = event.signedUp || 0;
      const calculatedSignedUp = await event.calculateSignedUp();

      if (currentSignedUp !== calculatedSignedUp) {
        await Event.findByIdAndUpdate(event._id, {
          signedUp: calculatedSignedUp,
        });
        updatedCount++;
      }
    }

    return updatedCount;
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

      // Build filter object
      const filter: any = {};

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

      // If status filtering is requested, we need to handle it differently
      // First, update all event statuses to ensure they're current
      if (status) {
        await EventController.updateAllEventStatusesHelper();
        // Now we can filter by the updated status
        filter.status = status;
      }

      // Get events with pagination and status filter applied
      const events = await Event.find(filter)
        .populate("createdBy", "username firstName lastName avatar")
        .sort(sort)
        .skip(skip)
        .limit(limitNumber);

      // If no status filter was applied, still update individual event statuses
      if (!status) {
        for (const event of events) {
          await EventController.updateEventStatusIfNeeded(event);
        }
      }

      const totalEvents = await Event.countDocuments(filter);
      const totalPages = Math.ceil(totalEvents / limitNumber);

      res.status(200).json({
        success: true,
        data: {
          events: events,
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

      // CRITICAL FIX: Always populate fresh organizer contact information from User collection
      // This ensures that even if users update their profile, events show current contact info
      if (event.organizerDetails && event.organizerDetails.length > 0) {
        const updatedOrganizerDetails =
          await EventController.populateFreshOrganizerContacts(
            event.organizerDetails
          );

        // Create a new event object with updated organizer details
        const eventWithFreshContacts = {
          ...event.toObject(),
          organizerDetails: updatedOrganizerDetails,
        };

        res.status(200).json({
          success: true,
          data: { event: eventWithFreshContacts },
        });
        return;
      }

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

      // SIMPLIFIED: Store only essential organizer info, contact details fetched at read time
      // This prevents stale data and reduces storage redundancy
      let processedOrganizerDetails: any[] = [];
      if (
        eventData.organizerDetails &&
        Array.isArray(eventData.organizerDetails)
      ) {
        processedOrganizerDetails = eventData.organizerDetails.map(
          (organizer: any) => ({
            userId: organizer.userId, // Essential for lookup
            name: organizer.name, // Display name
            role: organizer.role, // Organizer role
            avatar: organizer.avatar, // Avatar URL if provided
            gender: organizer.gender, // For default avatar selection
            // NOTE: email and phone are now ALWAYS fetched fresh from User collection in getEventById
            email: "placeholder@example.com", // Placeholder - will be replaced at read time
            phone: "Phone not provided", // Placeholder - will be replaced at read time
          })
        );
      }

      // Create event
      const event = new Event({
        ...eventData,
        organizerDetails: processedOrganizerDetails,
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

      // SIMPLIFIED: Store only essential organizer info, contact details fetched at read time
      if (
        updateData.organizerDetails &&
        Array.isArray(updateData.organizerDetails)
      ) {
        updateData.organizerDetails = updateData.organizerDetails.map(
          (organizer: any) => ({
            userId: organizer.userId, // Essential for lookup
            name: organizer.name, // Display name
            role: organizer.role, // Organizer role
            avatar: organizer.avatar, // Avatar URL if provided
            gender: organizer.gender, // For default avatar selection
            // NOTE: email and phone are now ALWAYS fetched fresh from User collection in getEventById
            email: "placeholder@example.com", // Placeholder - will be replaced at read time
            phone: "Phone not provided", // Placeholder - will be replaced at read time
          })
        );
      }

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

  // Sign up for event role (THREAD-SAFE VERSION)
  static async signUpForEvent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { roleId, notes, specialRequirements }: EventSignupRequest =
        req.body;

      // Basic validation
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

      // Pre-flight checks (before acquiring lock)
      const event = await Event.findById(id);
      if (!event) {
        res.status(404).json({
          success: false,
          message: "Event not found.",
        });
        return;
      }

      if (event.status !== "upcoming") {
        res.status(400).json({
          success: false,
          message: "Cannot sign up for this event.",
        });
        return;
      }

      // User role and capacity checks
      const userSignupInfo = await RegistrationQueryService.getUserSignupInfo(
        (req.user!._id as mongoose.Types.ObjectId).toString()
      );
      const userCurrentSignups = userSignupInfo?.currentSignups || 0;

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

      const userRoleLimit = getRoleLimit(req.user.role);
      if (userCurrentSignups >= userRoleLimit) {
        res.status(400).json({
          success: false,
          message: `You have reached the maximum number of roles (${userRoleLimit}) allowed for your authorization level (${req.user.role}).`,
        });
        return;
      }

      // Role permission checks
      const targetRole = event.roles.find((role) => role.id === roleId);
      if (!targetRole) {
        res.status(400).json({
          success: false,
          message: "Role not found in this event.",
        });
        return;
      }

      const participantAllowedRoles = [
        "Prepared Speaker (on-site)",
        "Prepared Speaker (Zoom)",
        "Common Participant (on-site)",
        "Common Participant (Zoom)",
      ];

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

      // 🔒 ENHANCED CAPACITY-SAFE REGISTRATION (Standalone MongoDB) 🔒
      // Pre-check capacity to avoid unnecessary work (reduces race condition window)
      const currentCount = await Registration.countDocuments({
        eventId: id,
        roleId,
        status: "active",
      });

      if (currentCount >= targetRole.maxParticipants) {
        res.status(400).json({
          success: false,
          message: `This role is at full capacity (${currentCount}/${targetRole.maxParticipants}). Please try another role.`,
        });
        return;
      }

      // Create new registration record
      const newRegistration = new Registration({
        eventId: id,
        userId: req.user._id,
        roleId,
        status: "active",
        registrationDate: new Date(),
        notes,
        specialRequirements,
        registeredBy: req.user._id,
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
          roleName: targetRole.name,
          roleDescription: targetRole.description,
        },
      });

      try {
        // Attempt atomic save (protected by unique index for duplicates)
        await newRegistration.save();

        // Get updated event data using ResponseBuilderService
        const updatedEvent =
          await ResponseBuilderService.buildEventWithRegistrations(id);

        // Emit real-time event update for signup
        socketService.emitEventUpdate(id, "user_signed_up", {
          userId: req.user._id,
          roleId,
          roleName: targetRole.name,
          user: {
            userId: req.user._id,
            username: req.user.username,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
          },
          event: updatedEvent,
        });

        res.status(200).json({
          success: true,
          message: `Successfully signed up for ${targetRole.name}`,
          data: {
            event: updatedEvent,
          },
        });
      } catch (error: any) {
        if (error.code === 11000) {
          // Duplicate key error - user already registered (unique index protection)
          res.status(400).json({
            success: false,
            message: "You are already signed up for this role.",
          });
          return;
        } else {
          // Handle potential capacity race condition
          // Check if the error might be due to capacity being exceeded during the race window
          const finalCount = await Registration.countDocuments({
            eventId: id,
            roleId,
            status: "active",
          });

          if (finalCount >= targetRole.maxParticipants) {
            res.status(400).json({
              success: false,
              message: `Role became full while processing your request (${finalCount}/${targetRole.maxParticipants}). Please try another role.`,
            });
            return;
          }

          // Some other error, re-throw
          throw error;
        }
      }
    } catch (error: any) {
      console.error("Event signup error:", error);

      if (
        error.message.includes("already signed up") ||
        error.message.includes("already full") ||
        error.message.includes("timeout")
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

  // Cancel event signup (THREAD-SAFE VERSION)
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

      // Basic validation
      const event = await Event.findById(id);
      if (!event) {
        res.status(404).json({
          success: false,
          message: "Event not found.",
        });
        return;
      }

      const role = event.roles.find((r: IEventRole) => r.id === roleId);
      if (!role) {
        res.status(404).json({
          success: false,
          message: "Role not found.",
        });
        return;
      }

      // 🔒 REGISTRATION-BASED CANCELLATION (ATOMIC OPERATION) 🔒
      // Remove registration record - this is atomic and thread-safe
      const deletedRegistration = await Registration.findOneAndDelete({
        eventId: id,
        userId: req.user._id,
        roleId,
        status: "active",
      });

      if (!deletedRegistration) {
        res.status(400).json({
          success: false,
          message: "You are not signed up for this role.",
        });
        return;
      }

      // Get updated event data using ResponseBuilderService
      const updatedEvent =
        await ResponseBuilderService.buildEventWithRegistrations(id);

      // Emit real-time event update for cancellation
      socketService.emitEventUpdate(id, "user_cancelled", {
        userId: req.user._id,
        roleId,
        roleName: role.name,
        event: updatedEvent,
      });

      res.status(200).json({
        success: true,
        message: `Successfully cancelled signup for ${role.name}`,
        data: {
          event: updatedEvent,
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

  // Remove user from role (admin/organizer management operation)
  static async removeUserFromRole(req: Request, res: Response): Promise<void> {
    try {
      const { id: eventId } = req.params;
      const { userId, roleId } = req.body;

      const event = await Event.findById(eventId);
      if (!event) {
        res.status(404).json({
          success: false,
          message: "Event not found",
        });
        return;
      }

      // Verify role exists
      const role = event.roles.find((r: IEventRole) => r.id === roleId);
      if (!role) {
        res.status(404).json({
          success: false,
          message: "Role not found",
        });
        return;
      }

      // Remove the registration record (this is our single source of truth)
      const deletedRegistration = await Registration.findOneAndDelete({
        userId: new mongoose.Types.ObjectId(userId),
        eventId: event._id,
        roleId,
        status: "active",
      });

      if (!deletedRegistration) {
        res.status(404).json({
          success: false,
          message: "Registration not found",
        });
        return;
      }

      // Emit real-time event update to all connected clients
      socketService.emitEventUpdate(eventId, "user_removed", {
        userId,
        roleId,
        roleName: role.name,
        event,
      });

      res.status(200).json({
        success: true,
        message: `User removed from ${role.name} successfully`,
        data: { event },
      });
    } catch (error: any) {
      console.error("Remove user from role error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to remove user from role",
      });
    }
  }

  // Move user between roles (admin/organizer management operation)
  static async moveUserBetweenRoles(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { id: eventId } = req.params;
      const { userId, fromRoleId, toRoleId } = req.body;

      const event = await Event.findById(eventId);
      if (!event) {
        res.status(404).json({
          success: false,
          message: "Event not found",
        });
        return;
      }

      const sourceRole = event.roles.find(
        (r: IEventRole) => r.id === fromRoleId
      );
      const targetRole = event.roles.find((r: IEventRole) => r.id === toRoleId);

      if (!sourceRole || !targetRole) {
        res.status(404).json({
          success: false,
          message: "Source or target role not found",
        });
        return;
      }

      // Check if user is registered for source role
      const existingRegistration = await Registration.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        eventId: event._id,
        roleId: fromRoleId,
        status: "active",
      });

      if (!existingRegistration) {
        res.status(404).json({
          success: false,
          message: "User not found in source role",
        });
        return;
      }

      // 🔒 ENHANCED CAPACITY-SAFE ROLE MOVE 🔒
      // Pre-check target role capacity (reduces race condition window)
      const currentCount = await Registration.countDocuments({
        eventId: event._id,
        roleId: toRoleId,
        status: "active",
      });

      if (currentCount >= targetRole.maxParticipants) {
        res.status(400).json({
          success: false,
          message: `Target role is at full capacity (${currentCount}/${targetRole.maxParticipants})`,
        });
        return;
      }

      try {
        // Update registration record to move to new role (atomic operation)
        existingRegistration.roleId = toRoleId;
        // Update the event snapshot to reflect the new role
        existingRegistration.eventSnapshot.roleName = targetRole.name;
        existingRegistration.eventSnapshot.roleDescription =
          targetRole.description;

        await existingRegistration.save();

        // Get updated event data using ResponseBuilderService
        const updatedEvent =
          await ResponseBuilderService.buildEventWithRegistrations(eventId);

        // Emit real-time event update to all connected clients
        socketService.emitEventUpdate(eventId, "user_moved", {
          userId,
          fromRoleId,
          toRoleId,
          fromRoleName: sourceRole.name,
          toRoleName: targetRole.name,
          event: updatedEvent,
        });

        res.status(200).json({
          success: true,
          message: "User moved between roles successfully",
          data: { event: updatedEvent },
        });
      } catch (moveError: any) {
        // Handle potential capacity race condition for role moves
        const finalCount = await Registration.countDocuments({
          eventId: event._id,
          roleId: toRoleId,
          status: "active",
        });

        if (finalCount >= targetRole.maxParticipants) {
          res.status(400).json({
            success: false,
            message: `Target role became full while processing move (${finalCount}/${targetRole.maxParticipants})`,
          });
          return;
        }

        // Some other error, re-throw
        throw moveError;
      }
    } catch (error: any) {
      console.error("Move user between roles error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to move user between roles",
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
            "title date time endTime location format status type organizer createdAt roles",
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

          // Get current role name from event data instead of snapshot
          // This ensures we get the latest role name if the user was moved between roles
          const currentRole = event.roles?.find(
            (role: any) => role.id === reg.roleId
          );
          const currentRoleName = currentRole
            ? currentRole.name
            : reg.eventSnapshot.roleName;
          const currentRoleDescription = currentRole
            ? currentRole.description
            : reg.eventSnapshot.roleDescription;

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
              roleName: currentRoleName, // Use current role name instead of snapshot
              roleDescription: currentRoleDescription, // Use current role description instead of snapshot
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

      // Provide summary statistics based on unique events
      const uniqueEvents = new Map();
      events.forEach((e) => {
        uniqueEvents.set(e.event.id, e);
      });
      const uniqueEventsArray = Array.from(uniqueEvents.values());

      const stats = {
        total: uniqueEventsArray.length,
        upcoming: uniqueEventsArray.filter((e) => !e.isPassedEvent).length,
        passed: uniqueEventsArray.filter((e) => e.isPassedEvent).length,
        active: uniqueEventsArray.filter(
          (e) => e.registration.status === "active"
        ).length,
        cancelled: uniqueEventsArray.filter(
          (e) => e.event.status === "cancelled"
        ).length,
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
