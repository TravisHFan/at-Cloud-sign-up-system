/**
 * Response Builder Service
 *
 * Builds standardized API responses using Registration-based data
 * Part of Phase 2 Migration: Frontend Integration
 */

import { Event, Registration, User } from "../models";
import { Types } from "mongoose";
import { createLogger } from "./LoggerService";
import { RegistrationQueryService } from "./RegistrationQueryService";
import {
  EventWithRegistrationData,
  EventRoleWithCounts,
  RegistrationWithUser,
  UserBasicInfo,
  AnalyticsEventData,
  OrganizerDetail,
} from "../types/api-responses";

export type EventRole = {
  id: string;
  name: string;
  description?: string;
  maxParticipants: number;
  maxSignups?: number;
  // Whether this role is visible & registerable on the public (unauthenticated) event page
  openToPublic?: boolean;
};
export type LeanUser = {
  _id: Types.ObjectId;
  username: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  avatar?: string;
  gender?: "male" | "female";
  systemAuthorizationLevel?: string;
  roleInAtCloud?: string;
  role?: string;
};

type EventLean = {
  _id: Types.ObjectId;
  title: string;
  type?: string;
  date: string;
  endDate?: string;
  time: string;
  endTime?: string;
  location?: string;
  organizer?: string;
  hostedBy?: string;
  purpose?: string;
  agenda?: string;
  format?: string;
  timeZone?: string;
  flyerUrl?: string;
  zoomLink?: string;
  meetingId?: string;
  passcode?: string;
  disclaimer?: string;
  workshopGroupTopics?: Record<string, unknown>;
  organizerDetails?: Array<Record<string, unknown>>;
  roles: EventRole[];
  createdBy: LeanUser;
  createdAt?: Date;
  updatedAt?: Date;
  status?: string;
};

type RegLean = {
  _id: Types.ObjectId;
  userId: Types.ObjectId | (LeanUser & { _id: Types.ObjectId });
  eventId: Types.ObjectId;
  roleId: string;
  status?: string;
  createdAt?: Date;
};

// Minimal input shape for analytics event builder
export type AnalyticsEventInput = {
  _id: Types.ObjectId;
  title: string;
  date: string;
  endDate?: string;
  time: string;
  endTime?: string;
  location?: string;
  status?: string;
  format?: string;
  timeZone?: string;
  type?: string;
  hostedBy?: string;
  createdBy: LeanUser;
  roles: EventRole[];
};

export class ResponseBuilderService {
  private static logger = createLogger("ResponseBuilderService");
  /**
   * Helper method to populate fresh organizer contact information
   */
  private static async populateFreshOrganizerContacts(
    organizerDetails: Array<Record<string, unknown>>
  ): Promise<Array<Record<string, unknown>>> {
    if (!organizerDetails || organizerDetails.length === 0) {
      return [];
    }

    return Promise.all(
      organizerDetails.map(async (organizer) => {
        if ((organizer as { userId?: string }).userId) {
          // Get fresh contact info from User collection
          const user = await User.findById(
            (organizer as { userId: string }).userId
          ).select("email phone firstName lastName avatar");
          if (user) {
            return {
              ...organizer,
              email: user.email, // Always fresh from User collection
              phone: user.phone || "Phone not provided", // Always fresh
              name: `${user.firstName} ${user.lastName}`, // Ensure name is current
              avatar: user.avatar || (organizer as { avatar?: string }).avatar, // Use latest avatar
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
  static async buildEventWithRegistrations(
    eventId: string,
    viewerId?: string
  ): Promise<EventWithRegistrationData | null> {
    try {
      // Get basic event data
      const event = (await Event.findById(eventId)
        .populate(
          "createdBy",
          // Include contact and role fields so Organizer card can show email/phone
          "username firstName lastName email phone gender role roleInAtCloud avatar"
        )
        .lean()) as EventLean | null;

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
      const viewerRegistrations = (await Registration.find({
        eventId: event._id,
        userId: viewerId,
      }).lean()) as unknown as Array<{ roleId: string }>;

      const viewerGroupLetters: string[] = [];

      if (event.type === "Effective Communication Workshop") {
        for (const viewerReg of viewerRegistrations) {
          // Find the role that this registration belongs to
          const roleForViewer = event.roles.find(
            (role: EventRole) => role.id === viewerReg.roleId
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
        event.roles.map(async (role: EventRole) => {
          const registrations: RegistrationWithUser[] = [];

          // Get registrations for this role
          const roleRegistrations = (await Registration.find({
            eventId: event._id,
            roleId: role.id,
          })
            .populate({
              path: "userId",
              select:
                "username firstName lastName email phone avatar gender systemAuthorizationLevel roleInAtCloud role",
            })
            .lean()) as unknown as Array<
            RegLean & {
              userId: {
                _id: Types.ObjectId;
                username: string;
                firstName: string;
                lastName: string;
                email?: string;
                phone?: string;
                avatar?: string;
                gender?: "male" | "female";
                systemAuthorizationLevel?: string;
                roleInAtCloud?: string;
                role?: string;
              };
            }
          >;

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
              id: reg._id.toString(),
              userId: reg.userId._id.toString(),
              eventId: reg.eventId.toString(),
              roleId: reg.roleId,
              status: (reg.status ?? "active") as
                | "active"
                | "cancelled"
                | "waitlist",
              // Include participant-provided metadata
              notes: (reg as { notes?: string }).notes,
              specialRequirements: (reg as { specialRequirements?: string })
                .specialRequirements,
              user: {
                id: reg.userId._id.toString(),
                username: reg.userId.username,
                firstName: reg.userId.firstName,
                lastName: reg.userId.lastName,
                email: showContact ? email : "",
                phone: showContact ? phone : undefined,
                avatar: reg.userId.avatar,
                gender: reg.userId.gender,
                systemAuthorizationLevel:
                  reg.userId.systemAuthorizationLevel || "Participant",
                roleInAtCloud: reg.userId.roleInAtCloud || "",
                role:
                  reg.userId.role || reg.userId.systemAuthorizationLevel || "",
              },
              registeredAt: reg.createdAt || new Date(),
              eventSnapshot: {
                eventTitle: event.title,
                eventDate: event.date,
                eventTime: event.time,
                roleName: role.name,
                roleDescription: role.description || "",
              },
            });
          }

          const signupCount =
            eventSignupCounts.roles.find((r) => r.roleId === role.id)
              ?.currentCount || 0;
          const maxParticipants = role.maxParticipants || role.maxSignups || 0;
          const availableSpots = Math.max(0, maxParticipants - signupCount);

          return {
            id: role.id,
            name: role.name,
            description: role.description || "",
            agenda: (role as { agenda?: string }).agenda,
            maxParticipants: maxParticipants,
            // Surface openToPublic so create/update responses reflect current flag state
            openToPublic:
              (role as { openToPublic?: boolean }).openToPublic === true,
            currentCount: signupCount,
            currentSignups: signupCount,
            availableSpots: availableSpots,
            isFull: signupCount >= maxParticipants,
            waitlistCount: 0,
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
        type: event.type || "",
        date: event.date,
        endDate: event.endDate || event.date,
        time: event.time,
        endTime: event.endTime || event.time,
        location: event.location || "",
        organizer: event.organizer || "",
        hostedBy: event.hostedBy,
        purpose: event.purpose || "",
        agenda: event.agenda,
        format: event.format || "",
        timeZone: event.timeZone,
        flyerUrl: event.flyerUrl,
        // Programs & Mentors (optional)
        programId: (event as unknown as { programId?: Types.ObjectId | null })
          .programId
          ? (
              event as unknown as { programId?: Types.ObjectId | null }
            ).programId!.toString()
          : null,
        mentorCircle:
          (event as unknown as { mentorCircle?: "E" | "M" | "B" | "A" | null })
            .mentorCircle ?? null,
        mentors:
          (
            event as unknown as {
              mentors?: Array<{
                userId?: Types.ObjectId;
                name?: string;
                email?: string;
                gender?: "male" | "female";
                avatar?: string;
                roleInAtCloud?: string;
              }> | null;
            }
          ).mentors?.map((m) => ({
            userId: m.userId ? m.userId.toString() : undefined,
            name: m.name,
            email: m.email,
            gender: m.gender,
            avatar: m.avatar,
            roleInAtCloud: m.roleInAtCloud,
          })) ?? null,
        // Virtual meeting fields (optional)
        zoomLink: event.zoomLink,
        meetingId: event.meetingId,
        passcode: event.passcode,
        disclaimer: event.disclaimer,
        workshopGroupTopics: event.workshopGroupTopics || {},
        organizerDetails: freshOrganizerDetails as unknown as OrganizerDetail[],
        roles: rolesWithRegistrations,
        totalCapacity: event.roles.reduce(
          (total: number, r: EventRole) => total + r.maxParticipants,
          0
        ),
        totalRegistrations: eventSignupCounts.totalSignups,
        availableSpots:
          eventSignupCounts.totalSlots - eventSignupCounts.totalSignups,
        totalSlots: event.roles.reduce(
          (total: number, r: EventRole) => total + r.maxParticipants,
          0
        ),
        signedUp: eventSignupCounts.totalSignups,
        maxParticipants: eventSignupCounts.totalSlots,
        // Provide full organizer info to frontend (email/phone shown on Organizer card)
        createdBy: ResponseBuilderService.buildUserBasicInfo(event.createdBy),
        createdAt: event.createdAt || new Date(0),
        updatedAt: event.updatedAt || new Date(0),
        status: (event.status ||
          "upcoming") as EventWithRegistrationData["status"],
        // Publish metadata (needed for organizer UI to persist state across refresh)
        publish: (event as any).publish === true,
        publishedAt: (event as any).publishedAt || null,
        publicSlug: (event as any).publicSlug || undefined,
      };
    } catch (error) {
      this.logger.error("buildEventWithRegistrations error", error as Error);
      return null;
    }
  }

  /**
   * Builds multiple events with registration data
   * Used for events listing API responses
   */
  static async buildEventsWithRegistrations(
    events: Array<{ _id: Types.ObjectId }>
  ): Promise<EventWithRegistrationData[]> {
    if (!events || events.length === 0) {
      return [];
    }

    const eventsWithRegistrations = await Promise.all(
      events.map((event) =>
        ResponseBuilderService.buildEventWithRegistrations(event._id.toString())
      )
    );

    return eventsWithRegistrations.filter(
      (
        event: EventWithRegistrationData | null
      ): event is EventWithRegistrationData => event !== null
    );
  }

  /**
   * Builds basic user info
   * Used for user-related API responses
   */
  static buildUserBasicInfo(user: LeanUser | { id: string }): UserBasicInfo {
    return {
      id: (user as LeanUser)._id
        ? (user as LeanUser)._id.toString()
        : (user as { id: string }).id,
      username: (user as LeanUser).username,
      firstName: (user as LeanUser).firstName,
      lastName: (user as LeanUser).lastName,
      email: (user as LeanUser).email || "",
      phone: (user as LeanUser).phone,
      avatar: (user as LeanUser).avatar,
      gender: (user as LeanUser).gender,
      systemAuthorizationLevel:
        (user as LeanUser).role ||
        (user as LeanUser).systemAuthorizationLevel ||
        "Participant",
      roleInAtCloud: (user as LeanUser).roleInAtCloud || "",
      role:
        (user as LeanUser).role ||
        (user as LeanUser).systemAuthorizationLevel ||
        "",
    };
  }

  /**
   * Builds analytics event data
   * Used for analytics API responses
   */
  static async buildAnalyticsEventData(
    events: AnalyticsEventInput[]
  ): Promise<AnalyticsEventData[]> {
    if (!events || events.length === 0) {
      return [];
    }

    try {
      const analyticsData = await Promise.all(
        events.map(async (event) => {
          // Get registration counts for this event
          const eventSignupCounts =
            await RegistrationQueryService.getEventSignupCounts(
              event._id.toString()
            );

          // Fetch registrations for this event to power engagement metrics
          const eventRegistrations = await Registration.find({
            eventId: event._id,
          })
            .populate({
              path: "userId",
              select:
                "username firstName lastName systemAuthorizationLevel roleInAtCloud role avatar gender",
            })
            .lean();

          // Group registrations by role for quick lookup
          const regsByRole = new Map<string, RegLean[]>();
          for (const reg of (eventRegistrations as unknown as RegLean[]) ||
            []) {
            const key = reg.roleId;
            if (!regsByRole.has(key)) regsByRole.set(key, []);
            regsByRole.get(key)!.push(reg);
          }

          const totalSlots = eventSignupCounts
            ? event.roles.reduce(
                (total: number, role: EventRole) =>
                  total + role.maxParticipants,
                0
              )
            : 0;

          return {
            id: event._id.toString(),
            title: event.title,
            date: event.date,
            endDate: event.endDate || event.date,
            time: event.time,
            endTime: event.endTime || event.time, // fallback to time if endTime missing
            location: event.location || "",
            status: event.status || "upcoming",
            format: event.format || "",
            timeZone: event.timeZone,
            type: event.type || "",
            hostedBy: event.hostedBy || "@Cloud Marketplace Ministry", // default fallback
            createdBy: ResponseBuilderService.buildUserBasicInfo(
              event.createdBy
            ),
            roles: event.roles.map((role: EventRole) => {
              const roleCount =
                eventSignupCounts?.roles.find((r) => r.roleId === role.id)
                  ?.currentCount || 0;

              const roleRegs = (regsByRole.get(role.id) || []).map((reg) => ({
                id: reg._id.toString(),
                userId:
                  typeof reg.userId === "object" && "_id" in reg.userId
                    ? (reg.userId as LeanUser)._id.toString()
                    : (reg.userId as Types.ObjectId).toString(),
                eventId: reg.eventId.toString(),
                roleId: reg.roleId,
                status: (reg.status || "active") as
                  | "active"
                  | "cancelled"
                  | "waitlist",
                user: ResponseBuilderService.buildUserBasicInfo(
                  (typeof reg.userId === "object"
                    ? (reg.userId as LeanUser)
                    : ({
                        id: (reg.userId as Types.ObjectId).toString(),
                      } as { id: string })) as LeanUser | { id: string }
                ),
                registeredAt: reg.createdAt || new Date(),
                // Minimal snapshot for analytics; detailed snapshot not needed here
                eventSnapshot: {
                  eventTitle: event.title,
                  eventDate: event.date,
                  eventTime: event.time,
                  roleName: role.name,
                  roleDescription: role.description || "",
                },
              }));
              return {
                id: role.id,
                name: role.name,
                maxParticipants: role.maxParticipants,
                currentCount: roleCount,
                registrations: roleRegs, // Populated for engagement metrics
              };
            }),
            totalCapacity: totalSlots,
            totalRegistrations: eventSignupCounts?.totalSignups || 0,
            registrationRate:
              totalSlots > 0
                ? ((eventSignupCounts?.totalSignups || 0) / totalSlots) * 100
                : 0,
          };
        })
      );

      return analyticsData;
    } catch (error) {
      this.logger.error("Error building analytics event data", error as Error);
      return [];
    }
  }

  /**
   * Builds user signup status for a specific event
   * Used for user signup API responses
   */
  static async buildUserSignupStatus(
    userId: string,
    eventId: string
  ): Promise<{
    userId: string;
    eventId: string;
    isRegistered: boolean;
    canSignup: boolean;
    canSignupForMoreRoles: boolean;
    currentSignupCount: number;
    maxAllowedSignups: number;
    availableRoles: string[];
    restrictedRoles: string[];
    currentRole: string | null;
  } | null> {
    try {
      // Get event details
      const event = (await Event.findById(eventId).lean()) as
        | (Pick<EventLean, "_id" | "type" | "roles"> & { roles: EventRole[] })
        | null;
      if (!event) return null;

      // Get user details
      const user = (await User.findById(userId).lean()) as
        | (Pick<LeanUser, "systemAuthorizationLevel"> & { _id: Types.ObjectId })
        | null;
      if (!user) return null;

      // Get user signup info
      const userSignupInfo = await RegistrationQueryService.getUserSignupInfo(
        userId
      );
      if (!userSignupInfo) return null;

      // Get event signup counts
      const eventSignupCounts =
        await RegistrationQueryService.getEventSignupCounts(eventId);
      if (!eventSignupCounts) return null;

      // Check if user is already registered for this event
      const existingRegistration = (await Registration.findOne({
        userId,
        eventId,
      }).lean()) as unknown as { roleId?: string } | null;

      // Determine available and restricted roles based on user authorization level
      const availableRoles: string[] = [];
      const restrictedRoles: string[] = [];

      for (const role of event.roles) {
        const roleSignupData = eventSignupCounts.roles.find(
          (r) => r.roleId === role.id
        );
        const isFull = roleSignupData?.isFull || false;

        // Role restrictions based on authorization level
        if (user.systemAuthorizationLevel === "Participant") {
          // Participants: allow some roles depending on event type
          const webinarAllowed = [
            "Attendee",
            "Breakout Room Leads for E Circle",
            "Breakout Room Leads for M Circle",
            "Breakout Room Leads for B Circle",
            "Breakout Room Leads for A Circle",
          ];
          if (
            (event.type === "Webinar" && webinarAllowed.includes(role.name)) ||
            role.name.includes("Common Participant")
          ) {
            if (!isFull) availableRoles.push(role.name);
          } else {
            restrictedRoles.push(role.name);
          }
        } else {
          if (!isFull) availableRoles.push(role.name);
        }
      }

      const canSignup =
        !existingRegistration &&
        userSignupInfo.canSignupForMore &&
        availableRoles.length > 0;

      return {
        userId,
        eventId,
        isRegistered: !!existingRegistration,
        canSignup,
        canSignupForMoreRoles: userSignupInfo.canSignupForMore,
        currentSignupCount: userSignupInfo.currentSignups,
        maxAllowedSignups: userSignupInfo.maxAllowedSignups,
        availableRoles,
        restrictedRoles,
        currentRole: existingRegistration?.roleId || null,
      };
    } catch (error) {
      this.logger.error("Error building user signup status", error as Error);
      return null;
    }
  }
}
