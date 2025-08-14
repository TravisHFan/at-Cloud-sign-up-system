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
  private registrationQueryService: RegistrationQueryService;

  constructor() {
    this.registrationQueryService = new RegistrationQueryService();
  }

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
   * Builds event data with registration information
   * Used for event detail API responses
   */
  async buildEventWithRegistrations(
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

      // Get event signup counts
      const eventSignupCounts =
        await RegistrationQueryService.getEventSignupCounts(eventId);

      if (!eventSignupCounts) {
        return null;
      }

      // Determine viewer's group letters if applicable (for workshop privacy)
      // FIX: Support users registered in multiple groups by finding ALL their groups
      const viewerRegistrations = await Registration.find({
        eventId: event._id,
        userId: viewerId,
      }).lean();

      const viewerGroupLetters: string[] = [];

      if (event.type === "Effective Communication Workshop") {
        for (const viewerReg of viewerRegistrations) {
          // Find the role that this registration belongs to
          const roleForViewer = event.roles.find(
            (role: any) => role.id === viewerReg.roleId
          );
          if (roleForViewer) {
            // Extract group letter from role name using CONSISTENT regex
            const roleGroupMatch = roleForViewer.name.match(/Group ([A-F])/);
            if (roleGroupMatch) {
              const roleGroupLetter = roleGroupMatch[1];
              if (!viewerGroupLetters.includes(roleGroupLetter)) {
                viewerGroupLetters.push(roleGroupLetter);
              }
            }
          }
        }
      }

      // Build roles with registration data and privacy-aware contact info
      const rolesWithRegistrations: EventRoleWithCounts[] = await Promise.all(
        event.roles.map(async (role: any) => {
          const registrations: RegistrationWithUser[] = [];

          // Get registrations for this role
          const roleRegistrations = await Registration.find({
            eventId: event._id,
            roleId: role.id,
          })
            .populate({
              path: "userId",
              select:
                "username firstName lastName email phone avatar gender systemAuthorizationLevel roleInAtCloud",
            })
            .lean();

          // Transform each registration with privacy logic
          for (const reg of roleRegistrations) {
            let showContact = false;
            let email = "";
            let phone = "";

            // Always show contact to the person themselves
            const isSelf = reg.userId._id.toString() === viewerId;
            if (isSelf) {
              showContact = true;
              email = reg.userId.email || "";
              phone = reg.userId.phone || "";
            } else if (event.type === "Effective Communication Workshop") {
              // Workshop privacy: only show contacts within same group
              const roleGroupMatch = role.name.match(/Group ([A-F])/);
              const roleGroupLetter = roleGroupMatch?.[1] || null;

              const withinSameWorkshopGroup =
                roleGroupLetter && viewerGroupLetters.includes(roleGroupLetter);

              if (withinSameWorkshopGroup) {
                showContact = true;
                email = reg.userId.email || "";
                phone = reg.userId.phone || "";
              }
            } else {
              // Non-workshop events: show all contacts
              showContact = true;
              email = reg.userId.email || "";
              phone = reg.userId.phone || "";
            }

            registrations.push({
              id: (reg as any)._id.toString(),
              userId: reg.userId._id.toString(),
              eventId: reg.eventId.toString(),
              roleId: reg.roleId,
              status: reg.status || "active",
              user: {
                id: reg.userId._id.toString(),
                username: reg.userId.username,
                firstName: reg.userId.firstName,
                lastName: reg.userId.lastName,
                email: showContact ? email : "",
                phone: showContact ? phone : undefined,
                avatar: reg.userId.avatar,
                gender: reg.userId.gender,
                systemAuthorizationLevel: reg.userId.systemAuthorizationLevel,
                roleInAtCloud: reg.userId.roleInAtCloud,
                role: reg.userId.role || reg.userId.systemAuthorizationLevel,
              },
              registeredAt: reg.createdAt || new Date(),
              eventSnapshot: {
                eventTitle: event.title,
                eventDate: event.date,
                eventTime: event.time,
                roleName: role.name,
                roleDescription: role.description,
              },
            });
          }

          const signupCount =
            eventSignupCounts.roles.find((r) => r.roleId === role.id)
              ?.currentCount || 0;

          return {
            id: role.id,
            name: role.name,
            description: role.description,
            maxParticipants: role.maxParticipants,
            currentSignups: signupCount,
            registrations,
          };
        })
      );

      // Populate fresh organizer contact information
      const freshOrganizerDetails =
        await ResponseBuilderService.populateFreshOrganizerContacts(
          event.organizerDetails || []
        );

      return {
        id: event._id.toString(),
        title: event.title,
        type: event.type,
        date: event.date,
        time: event.time,
        endTime: event.endTime,
        location: event.location,
        organizer: event.organizer,
        hostedBy: event.hostedBy,
        purpose: event.purpose,
        agenda: event.agenda,
        format: event.format,
        disclaimer: event.disclaimer,
        workshopGroupTopics: event.workshopGroupTopics || {},
        organizerDetails: freshOrganizerDetails,
        roles: rolesWithRegistrations,
        totalCapacity: event.roles.reduce(
          (total: number, role: any) => total + role.maxParticipants,
          0
        ),
        totalRegistrations: eventSignupCounts.totalSignups,
        availableSpots:
          eventSignupCounts.totalSlots - eventSignupCounts.totalSignups,
        totalSlots: event.roles.reduce(
          (total: number, role: any) => total + role.maxParticipants,
          0
        ),
        signedUp: eventSignupCounts.totalSignups,
        maxParticipants: eventSignupCounts.totalSlots,
        createdBy: event.createdBy?._id?.toString(),
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
        status: event.status,
      };
    } catch (error) {
      console.error("buildEventWithRegistrations error:", error);
      throw error;
    }
  }

  /**
   * Builds multiple events with registration data
   * Used for events listing API responses
   */
  static async buildEventsWithRegistrations(
    events: any[]
  ): Promise<EventWithRegistrationData[]> {
    if (!events || events.length === 0) {
      return [];
    }

    const service = new ResponseBuilderService();

    const eventsWithRegistrations = await Promise.all(
      events.map((event) =>
        service.buildEventWithRegistrations(event._id.toString())
      )
    );

    return eventsWithRegistrations.filter(
      (event): event is EventWithRegistrationData => event !== null
    );
  }

  /**
   * Builds basic user info
   * Used for user-related API responses
   */
  static buildUserBasicInfo(user: any): UserBasicInfo {
    return {
      id: user._id?.toString() || user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      avatar: user.avatar,
      gender: user.gender,
      systemAuthorizationLevel: user.role || user.systemAuthorizationLevel,
      roleInAtCloud: user.roleInAtCloud,
      role: user.role || user.systemAuthorizationLevel,
    };
  }

  /**
   * Builds analytics event data
   * Used for analytics API responses
   */
  static async buildAnalyticsEventData(
    event: any
  ): Promise<AnalyticsEventData> {
    // Get registration counts for this event
    const eventSignupCounts =
      await RegistrationQueryService.getEventSignupCounts(event._id.toString());

    const totalSlots = event.roles.reduce(
      (total: number, role: any) => total + role.maxParticipants,
      0
    );

    return {
      id: event._id.toString(),
      title: event.title,
      date: event.date,
      time: event.time,
      location: event.location,
      status: event.status,
      format: event.format,
      type: event.type,
      createdBy: ResponseBuilderService.buildUserBasicInfo(event.createdBy),
      roles: event.roles.map((role: any) => {
        const roleCount =
          eventSignupCounts?.roles.find((r) => r.roleId === role.id)
            ?.currentCount || 0;
        return {
          id: role.id,
          name: role.name,
          maxParticipants: role.maxParticipants,
          currentCount: roleCount,
          registrations: [], // Can be populated if needed
        };
      }),
      totalCapacity: totalSlots,
      totalRegistrations: eventSignupCounts?.totalSignups || 0,
      registrationRate:
        totalSlots > 0
          ? ((eventSignupCounts?.totalSignups || 0) / totalSlots) * 100
          : 0,
    };
  }
}
