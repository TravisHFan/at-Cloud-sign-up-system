import { BaseApiClient, type UpdateEventPayload } from "./common";
import type { EventData, EventParticipant } from "../../types/event";
import type {
  MyEventStats,
  MyEventRegistrationItem,
} from "../../types/myEvents";

/**
 * Events API Service
 * Handles event CRUD operations, registration, participants, and management
 */
class EventsApiClient extends BaseApiClient {
  // ========== Event CRUD Operations ==========

  async getEvents(params?: {
    page?: number;
    limit?: number;
    status?: string; // single status filter
    statuses?: string; // multi-status comma delimited (backend supported)
    type?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }): Promise<{
    events: EventData[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalEvents: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const endpoint = `/events${
      queryParams.toString() ? `?${queryParams.toString()}` : ""
    }`;
    const response = await this.request<{
      events: EventData[];
      pagination: {
        currentPage: number;
        totalPages: number;
        totalEvents: number;
        hasNext: boolean;
        hasPrev: boolean;
      };
    }>(endpoint);

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to get events");
  }

  async getEvent(id: string): Promise<EventData> {
    const response = await this.request<{ event: EventData }>(`/events/${id}`);

    if (response.data) {
      return response.data.event;
    }

    throw new Error(response.message || "Failed to get event");
  }

  /**
   * Check if an event has any registrations (user or guest)
   * Used to determine if confirmation modal should be shown before deleting registrations
   */
  async hasRegistrations(id: string): Promise<{
    hasRegistrations: boolean;
    userCount: number;
    guestCount: number;
    totalCount: number;
  }> {
    const response = await this.request<{
      hasRegistrations: boolean;
      userCount: number;
      guestCount: number;
      totalCount: number;
    }>(`/events/${id}/has-registrations`);

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to check registrations");
  }

  async createEvent(eventData: unknown): Promise<EventData> {
    const payload = eventData as unknown;
    const response = await this.request<{ event: EventData }>("/events", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (response.data) {
      return response.data.event;
    }

    throw new Error(response.message || "Failed to create event");
  }

  // Check if a given start/end date-time overlaps existing events
  async checkEventTimeConflict(params: {
    startDate: string;
    startTime: string;
    endDate?: string;
    endTime?: string;
    excludeId?: string;
    mode?: "point" | "range";
    timeZone?: string;
  }): Promise<{
    conflict: boolean;
    conflicts: Array<{ id: string; title: string }>;
  }> {
    const qp = new URLSearchParams();
    qp.set("startDate", params.startDate);
    qp.set("startTime", params.startTime);
    if (params.endDate) qp.set("endDate", params.endDate);
    if (params.endTime) qp.set("endTime", params.endTime);
    if (params.excludeId) qp.set("excludeId", params.excludeId);
    if (params.mode) qp.set("mode", params.mode);
    if (params.timeZone) qp.set("timeZone", params.timeZone);
    const response = await this.request<{
      conflict: boolean;
      conflicts: Array<{ id: string; title: string }>;
    }>(`/events/check-conflict?${qp.toString()}`);
    if (response.data) return response.data;
    throw new Error(response.message || "Failed to check conflicts");
  }

  async updateEvent(
    eventId: string,
    eventData: UpdateEventPayload,
  ): Promise<EventData> {
    const response = await this.request<{ event: EventData }>(
      `/events/${eventId}`,
      {
        method: "PUT",
        body: JSON.stringify(eventData),
      },
    );

    if (response.data) {
      return response.data.event;
    }

    throw new Error(response.message || "Failed to update event");
  }

  async updateWorkshopGroupTopic(
    eventId: string,
    group: "A" | "B" | "C" | "D" | "E" | "F",
    topic: string,
  ): Promise<EventData> {
    const response = await this.request<{ event: EventData }>(
      `/events/${eventId}/workshop/groups/${group}/topic`,
      {
        method: "POST",
        body: JSON.stringify({ topic }),
      },
    );
    if (response.data) return response.data.event;
    throw new Error(response.message || "Failed to update group topic");
  }

  async deleteEvent(eventId: string): Promise<void> {
    await this.request(`/events/${eventId}`, {
      method: "DELETE",
    });
  }

  // ========== YouTube URL (Past Events) ==========

  /**
   * Update the YouTube video URL for a completed event
   * Only Super Admin, Administrator, event creator, or co-organizer can update
   */
  async updateYoutubeUrl(
    eventId: string,
    youtubeUrl: string | null,
  ): Promise<EventData> {
    const response = await this.request<{ event: EventData }>(
      `/events/${eventId}/youtube-url`,
      {
        method: "PATCH",
        body: JSON.stringify({ youtubeUrl }),
      },
    );

    if (response.data) {
      return response.data.event;
    }

    throw new Error(response.message || "Failed to update YouTube URL");
  }

  // ========== Event Publishing ==========

  async publishEvent(eventId: string): Promise<EventData> {
    const res = await this.request<EventData>(`/events/${eventId}/publish`, {
      method: "POST",
    });
    // Some environments may return a success message with no data payload; infer publish success.
    if (!res.data) {
      if (res.success) {
        return {
          id: eventId,
          title: "",
          type: "",
          date: "",
          time: "",
          endTime: "",
          location: "",
          organizer: "",
          roles: [],
          createdBy: "",
          createdAt: new Date().toISOString(),
          publish: true,
          publishedAt: new Date().toISOString(),
          publicSlug: undefined,
        } as unknown as EventData; // minimal inferred shape; caller only merges publish fields
      }
      throw new Error(res.message || "Failed to publish event");
    }
    return res.data;
  }

  // Unpublish an event. Returns updated event object (publish=false).
  async unpublishEvent(eventId: string): Promise<EventData> {
    const res = await this.request<EventData>(`/events/${eventId}/unpublish`, {
      method: "POST",
    });
    if (!res.data) {
      if (res.success) {
        return {
          id: eventId,
          title: "",
          type: "",
          date: "",
          time: "",
          endTime: "",
          location: "",
          organizer: "",
          roles: [],
          createdBy: "",
          createdAt: new Date().toISOString(),
          publish: false,
          publishedAt: undefined,
          publicSlug: undefined,
        } as unknown as EventData;
      }
      throw new Error(res.message || "Failed to unpublish event");
    }
    return res.data;
  }

  // ========== Event Participants ==========

  async getEventParticipants(eventId: string): Promise<EventParticipant[]> {
    const response = await this.request<{ participants: EventParticipant[] }>(
      `/events/${eventId}/participants`,
    );

    if (response.data) {
      return response.data.participants;
    }

    throw new Error(response.message || "Failed to get event participants");
  }

  // ========== Event Communication ==========

  async sendEventEmails(
    eventId: string,
    payload: {
      subject: string;
      bodyHtml: string;
      bodyText?: string;
      includeGuests?: boolean;
      includeUsers?: boolean;
    },
  ): Promise<{ recipientCount: number; sent?: number }> {
    type EmailResult = { recipientCount: number; sent?: number };
    const response = await this.request<EmailResult>(
      `/events/${eventId}/email`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );

    const isEmailResult = (v: unknown): v is EmailResult =>
      !!v &&
      typeof v === "object" &&
      ("recipientCount" in (v as Record<string, unknown>) ||
        "sent" in (v as Record<string, unknown>));

    const payloadData: unknown = response.data ?? null;
    if (isEmailResult(payloadData)) {
      return payloadData;
    }
    if (isEmailResult(response as unknown)) {
      return response as unknown as EmailResult;
    }
    if (
      typeof response.message === "string" &&
      /sent/i.test(response.message)
    ) {
      const match = response.message.match(/(\d+)[^\d]*$/);
      const guessed = match ? parseInt(match[1], 10) : 1;
      return { recipientCount: guessed };
    }
    throw new Error(response.message || "Failed to send emails");
  }

  // ========== User Registration ==========

  async signUpForEvent(
    eventId: string,
    roleId: string,
    notes?: string,
    specialRequirements?: string,
  ): Promise<EventData> {
    const response = await this.request<{ event: EventData }>(
      `/events/${eventId}/signup`,
      {
        method: "POST",
        body: JSON.stringify({
          roleId,
          notes,
          specialRequirements,
        }),
      },
    );

    if (response.data) {
      return response.data.event;
    }

    throw new Error(response.message || "Failed to sign up for event");
  }

  async cancelEventSignup(eventId: string, roleId: string): Promise<EventData> {
    const response = await this.request<{ event: EventData }>(
      `/events/${eventId}/cancel`,
      {
        method: "POST",
        body: JSON.stringify({ roleId }),
      },
    );

    if (response.data) {
      return response.data.event;
    }

    throw new Error(response.message || "Failed to cancel signup");
  }

  // ========== Event Management (Admin/Organizer) ==========

  async removeUserFromRole(
    eventId: string,
    userId: string,
    roleId: string,
  ): Promise<EventData> {
    const response = await this.request<{ event: EventData }>(
      `/events/${eventId}/manage/remove-user`,
      {
        method: "POST",
        body: JSON.stringify({
          userId,
          roleId,
        }),
      },
    );

    if (response.data) {
      return response.data.event;
    }

    throw new Error(response.message || "Failed to remove user from role");
  }

  async moveUserBetweenRoles(
    eventId: string,
    userId: string,
    fromRoleId: string,
    toRoleId: string,
  ): Promise<EventData> {
    const response = await this.request<{ event: EventData }>(
      `/events/${eventId}/manage/move-user`,
      {
        method: "POST",
        body: JSON.stringify({
          userId,
          fromRoleId,
          toRoleId,
        }),
      },
    );

    if (response.data) {
      return response.data.event;
    }

    throw new Error(response.message || "Failed to move user between roles");
  }

  async assignUserToRole(
    eventId: string,
    userId: string,
    roleId: string,
    notes?: string,
    sendNotifications?: boolean,
  ): Promise<EventData> {
    const response = await this.request<{ event: EventData }>(
      `/events/${eventId}/manage/assign-user`,
      {
        method: "POST",
        body: JSON.stringify({
          userId,
          roleId,
          notes,
          suppressNotifications: sendNotifications === false,
        }),
      },
    );

    if (response.data) {
      return response.data.event;
    }

    throw new Error(response.message || "Failed to assign user to role");
  }

  // ========== Event Status Management ==========

  async updateEventStatuses(): Promise<{ updatedCount: number }> {
    const response = await this.request<{ updatedCount: number }>(
      "/events/update-statuses",
      {
        method: "POST",
      },
    );

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to update event statuses");
  }

  // ========== User Event Queries ==========

  async getUserEvents(
    page?: number,
    limit?: number,
  ): Promise<
    | {
        events: MyEventRegistrationItem[];
        stats: MyEventStats & { active?: number; cancelled?: number };
        pagination?: {
          currentPage: number;
          totalPages: number;
          totalEvents: number;
          hasNext: boolean;
          hasPrev: boolean;
          pageSize?: number;
        };
      }
    | MyEventRegistrationItem[]
  > {
    const qp = new URLSearchParams();
    if (page) qp.append("page", String(page));
    if (limit) qp.append("limit", String(limit));
    const endpoint = `/events/user/registered${
      qp.toString() ? `?${qp.toString()}` : ""
    }`;
    const response = await this.request<{
      data: {
        events: MyEventRegistrationItem[];
        stats: MyEventStats & { active?: number; cancelled?: number };
        pagination?: {
          currentPage: number;
          totalPages: number;
          totalEvents: number;
          hasNext: boolean;
          hasPrev: boolean;
          pageSize?: number;
        };
      };
    }>(endpoint);

    if (response.data) {
      return response.data.data
        ? response.data.data
        : (response.data as unknown as MyEventRegistrationItem[]);
    }

    throw new Error(response.message || "Failed to get user events");
  }

  async getCreatedEvents(): Promise<EventData[]> {
    const response = await this.request<{ events: EventData[] }>(
      "/events/user/created",
    );

    if (response.data) {
      return response.data.events;
    }

    throw new Error(response.message || "Failed to get created events");
  }

  // ========== Paid Events (Phase 6) ==========

  /**
   * Check if current user has access to a paid event
   * Returns access status and reason
   */
  async checkEventAccess(eventId: string): Promise<{
    hasAccess: boolean;
    requiresPurchase: boolean;
    accessReason: string;
  }> {
    const response = await this.request<{
      hasAccess: boolean;
      requiresPurchase: boolean;
      accessReason: string;
    }>(`/events/${eventId}/access`);

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to check event access");
  }

  /**
   * Get event purchase information with optional promo code
   * Returns pricing details with discount applied
   */
  async getEventPurchaseInfo(
    eventId: string,
    promoCode?: string,
  ): Promise<{
    eventId: string;
    eventTitle: string;
    originalPrice: number; // in cents
    discount: number; // in cents
    finalPrice: number; // in cents
    promoCodeValid: boolean;
    promoCodeMessage: string;
  }> {
    const queryParams = promoCode
      ? `?promoCode=${encodeURIComponent(promoCode)}`
      : "";
    const response = await this.request<{
      eventId: string;
      eventTitle: string;
      originalPrice: number;
      discount: number;
      finalPrice: number;
      promoCodeValid: boolean;
      promoCodeMessage: string;
    }>(`/events/${eventId}/purchase-info${queryParams}`);

    if (response.data) {
      return response.data;
    }

    throw new Error(
      response.message || "Failed to get event purchase information",
    );
  }

  /**
   * Create a Stripe checkout session for event ticket purchase
   */
  async createEventPurchase(
    eventId: string,
    promoCode?: string,
  ): Promise<{
    sessionId: string;
    sessionUrl: string;
    purchaseId: string;
    orderNumber: string;
  }> {
    const response = await this.request<{
      sessionId: string;
      sessionUrl: string;
      purchaseId: string;
      orderNumber: string;
    }>(`/events/${eventId}/purchase`, {
      method: "POST",
      body: JSON.stringify({ promoCode }),
    });

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to create event purchase");
  }

  /**
   * Get list of users who purchased tickets for this event
   * Only available to organizers and admins
   */
  async getEventPurchases(eventId: string): Promise<{
    purchases: Array<{
      id: string;
      userId: string;
      name: string;
      email: string;
      paymentDate: string;
      amountPaid: number;
      promoCode: string | null;
      orderNumber: string;
    }>;
    totalCount: number;
    totalRevenue: number;
  }> {
    const response = await this.request<{
      purchases: Array<{
        id: string;
        userId: string;
        name: string;
        email: string;
        paymentDate: string;
        amountPaid: number;
        promoCode: string | null;
        orderNumber: string;
      }>;
      totalCount: number;
      totalRevenue: number;
    }>(`/events/${eventId}/purchases`);

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to fetch event purchases");
  }
}

// Export singleton instance
const eventsApiClient = new EventsApiClient();

// Export service methods
export const eventsService = {
  // CRUD
  getEvents: (params?: Parameters<typeof eventsApiClient.getEvents>[0]) =>
    eventsApiClient.getEvents(params),
  getEvent: (id: string) => eventsApiClient.getEvent(id),
  hasRegistrations: (id: string) => eventsApiClient.hasRegistrations(id),
  createEvent: (eventData: unknown) => eventsApiClient.createEvent(eventData),
  checkEventTimeConflict: (
    params: Parameters<typeof eventsApiClient.checkEventTimeConflict>[0],
  ) => eventsApiClient.checkEventTimeConflict(params),
  updateEvent: (eventId: string, eventData: UpdateEventPayload) =>
    eventsApiClient.updateEvent(eventId, eventData),
  updateWorkshopGroupTopic: (
    eventId: string,
    group: "A" | "B" | "C" | "D" | "E" | "F",
    topic: string,
  ) => eventsApiClient.updateWorkshopGroupTopic(eventId, group, topic),
  deleteEvent: (eventId: string) => eventsApiClient.deleteEvent(eventId),

  // YouTube URL (Past Events)
  updateYoutubeUrl: (eventId: string, youtubeUrl: string | null) =>
    eventsApiClient.updateYoutubeUrl(eventId, youtubeUrl),

  // Publishing
  publishEvent: (eventId: string) => eventsApiClient.publishEvent(eventId),
  unpublishEvent: (eventId: string) => eventsApiClient.unpublishEvent(eventId),

  // Participants
  getEventParticipants: (eventId: string) =>
    eventsApiClient.getEventParticipants(eventId),

  // Communication
  sendEventEmails: (
    eventId: string,
    payload: Parameters<typeof eventsApiClient.sendEventEmails>[1],
  ) => eventsApiClient.sendEventEmails(eventId, payload),

  // User registration
  signUpForEvent: (
    eventId: string,
    roleId: string,
    notes?: string,
    specialRequirements?: string,
  ) =>
    eventsApiClient.signUpForEvent(eventId, roleId, notes, specialRequirements),
  cancelEventSignup: (eventId: string, roleId: string) =>
    eventsApiClient.cancelEventSignup(eventId, roleId),

  // Management
  removeUserFromRole: (eventId: string, userId: string, roleId: string) =>
    eventsApiClient.removeUserFromRole(eventId, userId, roleId),
  moveUserBetweenRoles: (
    eventId: string,
    userId: string,
    fromRoleId: string,
    toRoleId: string,
  ) =>
    eventsApiClient.moveUserBetweenRoles(eventId, userId, fromRoleId, toRoleId),
  assignUserToRole: (
    eventId: string,
    userId: string,
    roleId: string,
    notes?: string,
    sendNotifications?: boolean,
  ) =>
    eventsApiClient.assignUserToRole(
      eventId,
      userId,
      roleId,
      notes,
      sendNotifications,
    ),

  // Status management
  updateEventStatuses: () => eventsApiClient.updateEventStatuses(),

  // User queries
  getUserEvents: (page?: number, limit?: number) =>
    eventsApiClient.getUserEvents(page, limit),
  getCreatedEvents: () => eventsApiClient.getCreatedEvents(),

  // Paid Events (Phase 6)
  checkEventAccess: (eventId: string) =>
    eventsApiClient.checkEventAccess(eventId),
  getEventPurchaseInfo: (eventId: string, promoCode?: string) =>
    eventsApiClient.getEventPurchaseInfo(eventId, promoCode),
  createEventPurchase: (eventId: string, promoCode?: string) =>
    eventsApiClient.createEventPurchase(eventId, promoCode),
  getEventPurchases: (eventId: string) =>
    eventsApiClient.getEventPurchases(eventId),
};

// Legacy export (singular name for backward compatibility)
export const eventService = eventsService;
