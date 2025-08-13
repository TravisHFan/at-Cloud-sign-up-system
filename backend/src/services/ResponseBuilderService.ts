/**
 * Response Builder Service
 *
 * Builds standardized API responses using Registration-based data
 * Part of Phase 2 Migration: Frontend Integration
 */

import { Event, Registration, User } from "../models";
import { RegistrationQueryService } from "./RegistrationQueryService";
import {
  EventWithRegistrationData,
  EventRoleWithCounts,
  RegistrationWithUser,
  UserBasicInfo,
  AnalyticsEventData,
} from "../types/api-responses";

export class ResponseBuilderService {
  /**
   * Helper method to populate fresh organizer contact information
   */
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
              ...organizer,
              email: user.email, // Always fresh from User collection
              phone: user.phone || "Phone not provided", // Always fresh
              name: `${user.firstName} ${user.lastName}`, // Ensure name is current
              avatar: user.avatar || organizer.avatar, // Use latest avatar
            };
          }
        }
        // If no userId or user not found, return stored data
        return organizer;
      })
    );
  }
  /**
   * Build a complete event response with registration data
   */
  static async buildEventWithRegistrations(
    eventId: string,
    viewerId?: string
  ): Promise<EventWithRegistrationData | null> {
    try {
      // Get basic event data
      const event = (await Event.findById(eventId)
        .populate("createdBy", "username firstName lastName role avatar")
        .lean()) as any;

      if (!event) {
        return null;
      }

      // Get registration counts for all roles
      const eventSignupCounts =
        await RegistrationQueryService.getEventSignupCounts(eventId);

      if (!eventSignupCounts) {
        return null;
      }

      // Determine viewer's group letter if applicable (for workshop privacy)
      let viewerGroupLetter: "A" | "B" | "C" | "D" | "E" | "F" | null = null;
      if (viewerId && event.type === "Effective Communication Workshop") {
        const viewerReg = (await Registration.findOne({
          eventId: eventId,
          userId: viewerId,
        }).lean()) as any;
        if (viewerReg) {
          const viewerRole = (event.roles as any[]).find(
            (r) => r.id === viewerReg.roleId
          );
          if (viewerRole && typeof viewerRole.name === "string") {
            const m = viewerRole.name.match(
              /^Group ([A-F]) (Leader|Participants)$/
            );
            if (m) viewerGroupLetter = m[1] as any;
          }
        }
      }

      // Build roles with registration data
      const rolesWithCounts: EventRoleWithCounts[] = await Promise.all(
        event.roles.map(async (role: any) => {
          // Parse role group letter if any
          let roleGroupLetter: typeof viewerGroupLetter = null;
          if (typeof role.name === "string") {
            const m = role.name.match(/^Group ([A-F]) (Leader|Participants)$/);
            if (m) roleGroupLetter = m[1] as any;
          }
          // Get registrations for this role (no status filtering needed)
          const registrations = await Registration.find({
            eventId: eventId,
            roleId: role.id,
          })
            .populate(
              "userId",
              "username firstName lastName email phone gender systemAuthorizationLevel roleInAtCloud role avatar"
            )
            .lean();

          // Find role availability data
          const roleAvailability = eventSignupCounts.roles.find(
            (r) => r.roleId === role.id
          );

          // Build registration data with user info
          const registrationsWithUser: RegistrationWithUser[] =
            registrations.map((reg: any) => {
              const isSelf = viewerId && reg.userId._id.toString() === viewerId;
              const withinSameWorkshopGroup =
                event.type === "Effective Communication Workshop" &&
                !!roleGroupLetter &&
                !!viewerGroupLetter &&
                roleGroupLetter === viewerGroupLetter;
              const showContact = Boolean(isSelf || withinSameWorkshopGroup);
              return {
                id: reg._id.toString(),
                userId: reg.userId._id.toString(),
                eventId: reg.eventId.toString(),
                roleId: reg.roleId,
                status: reg.status,
                user: {
                  id: reg.userId._id.toString(),
                  username: reg.userId.username,
                  firstName: reg.userId.firstName,
                  lastName: reg.userId.lastName,
                  // Hide email outside of same workshop group by returning empty string
                  email: showContact ? reg.userId.email : "",
                  // Phone is optional; hide when not allowed
                  phone: showContact ? reg.userId.phone : undefined,
                  gender: reg.userId.gender,
                  systemAuthorizationLevel: reg.userId.systemAuthorizationLevel,
                  roleInAtCloud: reg.userId.roleInAtCloud,
                  role: reg.userId.role,
                  avatar: reg.userId.avatar,
                },
                registeredAt: reg.createdAt,
                eventSnapshot: reg.eventSnapshot,
              };
            });

          return {
            id: role.id,
            name: role.name,
            description: role.description,
            maxParticipants: role.maxParticipants,
            currentCount: roleAvailability?.currentCount || 0,
            availableSpots:
              roleAvailability?.availableSpots || role.maxParticipants,
            isFull: roleAvailability?.isFull || false,
            waitlistCount: roleAvailability?.waitlistCount || 0,
            registrations: registrationsWithUser,
          };
        })
      );

      // FIX: Populate fresh organizer contact information
      // This ensures frontend displays current email and phone from User collection
      const freshOrganizerDetails =
        await ResponseBuilderService.populateFreshOrganizerContacts(
          event.organizerDetails || []
        );

      // Build complete event response
      return {
        id: event._id.toString(),
        title: event.title,
        type: event.type, // FIX: Add missing type field
        date: event.date,
        time: event.time,
        endTime: event.endTime,
        location: event.location,
        organizer: event.organizer,
        organizerDetails: freshOrganizerDetails,
        hostedBy: event.hostedBy,
        purpose: event.purpose,
        agenda: event.agenda,
        format: event.format,
        disclaimer: event.disclaimer,
        description: event.description,
        isHybrid: event.isHybrid,
        zoomLink: event.zoomLink,
        meetingId: event.meetingId,
        passcode: event.passcode,
        requirements: event.requirements,
        // Include workshop group topics when present
        workshopGroupTopics: event.workshopGroupTopics,
        status: event.status,
        createdBy: {
          id: (event.createdBy as any)._id.toString(),
          username: (event.createdBy as any).username,
          firstName: (event.createdBy as any).firstName,
          lastName: (event.createdBy as any).lastName,
          email: (event.createdBy as any).email || "",
          gender: (event.createdBy as any).gender,
          systemAuthorizationLevel:
            (event.createdBy as any).systemAuthorizationLevel || "",
          roleInAtCloud: (event.createdBy as any).roleInAtCloud || "",
          role: (event.createdBy as any).role || "",
          avatar: (event.createdBy as any).avatar,
        },
        roles: rolesWithCounts,
        totalCapacity: eventSignupCounts.totalSlots,
        totalRegistrations: eventSignupCounts.totalSignups,
        availableSpots:
          eventSignupCounts.totalSlots - eventSignupCounts.totalSignups,
        // FIX: Add frontend-compatible field names for event cards
        totalSlots: eventSignupCounts.totalSlots,
        signedUp: eventSignupCounts.totalSignups,
        // FIX: Add backward compatibility alias for tests expecting maxParticipants
        maxParticipants: eventSignupCounts.totalSlots,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
      };
    } catch (error) {
      console.error("Error building event with registrations:", error);
      return null;
    }
  }

  /**
   * Build multiple events with registration data
   */
  static async buildEventsWithRegistrations(
    events: any[]
  ): Promise<EventWithRegistrationData[]> {
    const eventPromises = events.map((event) =>
      ResponseBuilderService.buildEventWithRegistrations(event._id.toString())
    );

    const results = await Promise.all(eventPromises);
    return results.filter(
      (event) => event !== null
    ) as EventWithRegistrationData[];
  }

  /**
   * Build analytics event data with registration counts
   */
  static async buildAnalyticsEventData(
    events: any[]
  ): Promise<AnalyticsEventData[]> {
    const analyticsPromises = events.map(async (event: any) => {
      // Get registration counts for this event
      const eventSignupCounts =
        await RegistrationQueryService.getEventSignupCounts(
          event._id.toString()
        );

      // Get registrations with user data for each role
      const rolesWithData = await Promise.all(
        event.roles.map(async (role: any) => {
          const registrations = await Registration.find({
            eventId: event._id,
            roleId: role.id,
          })
            .populate(
              "userId",
              "username firstName lastName email gender systemAuthorizationLevel roleInAtCloud role avatar"
            )
            .lean();

          const registrationsWithUser: RegistrationWithUser[] =
            registrations.map((reg: any) => ({
              id: reg._id.toString(),
              userId: reg.userId._id.toString(),
              eventId: reg.eventId.toString(),
              roleId: reg.roleId,
              status: reg.status,
              user: {
                id: reg.userId._id.toString(),
                username: reg.userId.username,
                firstName: reg.userId.firstName,
                lastName: reg.userId.lastName,
                email: reg.userId.email,
                gender: reg.userId.gender,
                systemAuthorizationLevel: reg.userId.systemAuthorizationLevel,
                roleInAtCloud: reg.userId.roleInAtCloud,
                role: reg.userId.role,
                avatar: reg.userId.avatar,
              },
              registeredAt: reg.createdAt,
              eventSnapshot: reg.eventSnapshot,
            }));

          // Find role count data
          const roleCount = eventSignupCounts?.roles.find(
            (r) => r.roleId === role.id
          );

          return {
            id: role.id,
            name: role.name,
            description: role.description,
            maxParticipants: role.maxParticipants,
            currentCount: roleCount?.currentCount || 0,
            // Convert registrations to currentSignups format for frontend compatibility
            currentSignups: registrationsWithUser.map((reg) => ({
              userId: reg.user.id,
              username: reg.user.username,
              firstName: reg.user.firstName,
              lastName: reg.user.lastName,
              avatar: reg.user.avatar,
              gender: reg.user.gender,
              systemAuthorizationLevel: reg.user.systemAuthorizationLevel,
              roleInAtCloud: reg.user.roleInAtCloud,
              role: reg.user.role,
              notes: "", // Note: the Registration model doesn't seem to store notes in the current schema
              registeredAt: reg.registeredAt,
            })),
            registrations: registrationsWithUser,
          };
        })
      );

      const totalCapacity = eventSignupCounts?.totalSlots || 0;
      const totalRegistrations = eventSignupCounts?.totalSignups || 0;

      return {
        id: event._id.toString(),
        title: event.title,
        date: event.date,
        time: event.time,
        endTime: event.endTime || event.time, // Add endTime with fallback
        location: event.location,
        status: event.status,
        format: event.format,
        type: event.type,
        organizer: event.organizer || "", // Add organizer field
        organizerDetails: event.organizerDetails || [], // Add organizerDetails
        hostedBy: event.hostedBy || "@Cloud Marketplace Ministry", // Add hostedBy with default
        purpose: event.purpose || "", // Add purpose
        agenda: event.agenda, // Add agenda
        disclaimer: event.disclaimer, // Add disclaimer
        description: event.description, // Add description
        isHybrid: event.isHybrid, // Add isHybrid
        zoomLink: event.zoomLink, // Add zoomLink
        meetingId: event.meetingId, // Add meetingId
        passcode: event.passcode, // Add passcode
        requirements: event.requirements, // Add requirements
        materials: event.materials, // Add materials
        attendees: event.attendees, // Add attendees
        createdAt: event.createdAt, // Add createdAt
        createdBy: {
          id: event.createdBy._id.toString(),
          username: event.createdBy.username,
          firstName: event.createdBy.firstName,
          lastName: event.createdBy.lastName,
          email: event.createdBy.email || "",
          gender: event.createdBy.gender,
          systemAuthorizationLevel:
            event.createdBy.systemAuthorizationLevel || "",
          roleInAtCloud: event.createdBy.roleInAtCloud || "",
          role: event.createdBy.role || "",
          avatar: event.createdBy.avatar,
        },
        roles: rolesWithData,
        // Map totalCapacity and totalRegistrations to expected frontend fields
        totalSlots: totalCapacity,
        signedUp: totalRegistrations,
        totalCapacity,
        totalRegistrations,
        registrationRate:
          totalCapacity > 0
            ? Math.round((totalRegistrations / totalCapacity) * 100)
            : 0,
      };
    });

    return Promise.all(analyticsPromises);
  }

  /**
   * Build user signup status for a specific event
   */
  static async buildUserSignupStatus(
    userId: string,
    eventId: string
  ): Promise<any> {
    try {
      // Check if user is registered for any role in this event (no status filtering needed)
      const existingRegistration = (await Registration.findOne({
        userId: userId,
        eventId: eventId,
      }).lean()) as any;

      // Get user's overall signup info
      const userSignupInfo = await RegistrationQueryService.getUserSignupInfo(
        userId
      );

      // Get event role availability
      const eventSignupCounts =
        await RegistrationQueryService.getEventSignupCounts(eventId);

      if (!eventSignupCounts || !userSignupInfo) {
        return null;
      }

      // Determine available roles based on user's role restrictions
      const event = (await Event.findById(eventId).lean()) as any;
      if (!event) {
        return null;
      }

      const user = (await User.findById(userId).lean()) as any;
      if (!user) {
        return null;
      }

      // Role restrictions based on user's system authorization level
      const participantAllowedRoles = [
        "Common Participant (on-site)",
        "Common Participant (Zoom)",
        "Prepared Speaker (on-site)",
        "Prepared Speaker (Zoom)",
      ];

      const availableRoles: string[] = [];
      const restrictedRoles: string[] = [];

      event.roles.forEach((role: any) => {
        if (
          (user as any).systemAuthorizationLevel === "Participant" &&
          !participantAllowedRoles.includes(role.name)
        ) {
          restrictedRoles.push(role.name);
        } else {
          const roleData = eventSignupCounts.roles.find(
            (r) => r.roleId === role.id
          );
          if (roleData && !roleData.isFull) {
            availableRoles.push(role.name);
          }
        }
      });

      return {
        userId: userId,
        eventId: eventId,
        isRegistered: !!existingRegistration,
        currentRole: existingRegistration?.roleId || null,
        canSignup:
          !existingRegistration &&
          userSignupInfo.canSignupForMore &&
          availableRoles.length > 0,
        canSignupForMoreRoles: userSignupInfo.canSignupForMore,
        currentSignupCount: userSignupInfo.currentSignups,
        maxAllowedSignups: userSignupInfo.maxAllowedSignups,
        availableRoles,
        restrictedRoles,
      };
    } catch (error) {
      console.error("Error building user signup status:", error);
      return null;
    }
  }
}
