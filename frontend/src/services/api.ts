// API Configuration
// Canonical API base (single stable /api root)
import type { EventData, EventParticipant } from "../types/event";
import type { User as AppUser } from "../types";
import type { MyEventStats, MyEventRegistrationItem } from "../types/myEvents";
import type { Notification, SystemMessage } from "../types/notification";
import { handleSessionExpired } from "./session";
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5001/api";

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
}

export interface AuthResponse {
  user: {
    id: string;
    username: string;
    email: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    gender?: string;
    role: string;
    isAtCloudLeader: boolean;
    roleInAtCloud?: string;
    avatar?: string;
    weeklyChurch?: string;
    churchAddress?: string;
    occupation?: string;
    company?: string;
    homeAddress?: string;
    lastLogin?: string;
    createdAt?: string;
    isVerified?: boolean;
    isActive?: boolean;
  };
  accessToken: string;
  expiresAt: string;
}

// Normalize and sanitize provided base URL (remove legacy version segments)
function sanitizeBaseURL(url: string): string {
  if (!url) return "/api";
  let sanitized = url.trim();
  // Remove any trailing slashes first
  sanitized = sanitized.replace(/\/$/, "");
  // Replace legacy /api/v1 with /api
  sanitized = sanitized.replace(/\/api\/v1(?=$|\b)/, "/api");
  // Collapse duplicate /api/api
  sanitized = sanitized.replace(/\/api\/api$/, "/api");
  // Ensure ends with /api (if it already ends with /api that's fine)
  if (!/\/api$/.test(sanitized)) {
    sanitized = sanitized + "/api";
  }
  return sanitized;
}

// Minimal payload shape used in tests for updateEvent
export type UpdateEventPayload = Record<string, unknown> & {
  organizerDetails: unknown[];
};

// Minimal guest summary for admin views and token-based management
interface GuestSummary {
  id?: string;
  _id?: string;
  fullName: string;
  email?: string;
  phone?: string;
  notes?: string;
  roleId: string;
  manageToken?: string;
}

// API Client Class
class ApiClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    const normalized = sanitizeBaseURL(baseURL);
    this.baseURL = normalized;
  }

  // Guest endpoints
  async guestSignup(
    eventId: string,
    payload: {
      fullName: string;
      gender?: "male" | "female";
      email: string;
      phone?: string;
      notes?: string;
      roleId: string;
    }
  ): Promise<{ registrationId: string }> {
    const res = await this.request<{ registrationId: string }>(
      `/events/${eventId}/guest-signup`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
    return res.data as { registrationId: string };
  }

  async getEventGuests(eventId: string): Promise<{ guests: GuestSummary[] }> {
    const res = await this.request<{ guests: GuestSummary[] }>(
      `/events/${eventId}/guests`
    );
    return (res.data as { guests: GuestSummary[] }) || { guests: [] };
  }

  // Organizer/Admin: Re-send manage link (event-scoped)
  async resendGuestManageLinkForEvent(
    eventId: string,
    guestRegistrationId: string
  ): Promise<void> {
    await this.request(
      `/events/${eventId}/manage/guests/${guestRegistrationId}/resend-manage-link`,
      { method: "POST" }
    );
  }
  // Admin-only legacy endpoint
  async resendGuestManageLink(guestRegistrationId: string): Promise<void> {
    await this.request(
      `/guest-registrations/${guestRegistrationId}/resend-manage-link`,
      { method: "POST" }
    );
  }

  // Organizer/Admin: Update guest (event-scoped)
  async updateGuestRegistrationForEvent(
    eventId: string,
    guestRegistrationId: string,
    payload: { fullName?: string; phone?: string; notes?: string }
  ): Promise<unknown> {
    const res = await this.request<unknown>(
      `/events/${eventId}/manage/guests/${guestRegistrationId}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      }
    );
    return res.data;
  }
  // Admin-only legacy endpoint
  async updateGuestRegistration(
    guestRegistrationId: string,
    payload: { fullName?: string; phone?: string; notes?: string }
  ): Promise<unknown> {
    const res = await this.request<unknown>(
      `/guest-registrations/${guestRegistrationId}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      }
    );
    return res.data;
  }

  // Organizer/Admin: Cancel guest (event-scoped)
  async cancelGuestRegistrationForEvent(
    eventId: string,
    guestRegistrationId: string,
    reason?: string
  ): Promise<unknown> {
    const res = await this.request<unknown>(
      `/events/${eventId}/manage/guests/${guestRegistrationId}`,
      {
        method: "DELETE",
        body: JSON.stringify({ reason }),
      }
    );
    return res.data;
  }
  // Admin-only legacy endpoint
  async cancelGuestRegistration(
    guestRegistrationId: string,
    reason?: string
  ): Promise<unknown> {
    const res = await this.request<unknown>(
      `/guest-registrations/${guestRegistrationId}`,
      {
        method: "DELETE",
        body: JSON.stringify({ reason }),
      }
    );
    return res.data;
  }

  // Guest self-service by token
  async getGuestByToken(token: string): Promise<unknown> {
    const res = await this.request<unknown>(`/guest/manage/${token}`);
    return res.data;
  }
  async updateGuestByToken(
    token: string,
    payload: { fullName?: string; phone?: string; notes?: string }
  ): Promise<unknown> {
    const res = await this.request<unknown>(`/guest/manage/${token}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return res.data;
  }
  async cancelGuestByToken(token: string, reason?: string): Promise<unknown> {
    const res = await this.request<unknown>(`/guest/manage/${token}`, {
      method: "DELETE",
      body: JSON.stringify({ reason }),
    });
    return res.data;
  }

  // Event templates (read-only)
  async getEventTemplates(): Promise<{
    allowedTypes: string[];
    templates: Record<
      string,
      Array<{ name: string; description: string; maxParticipants: number }>
    >;
  }> {
    const response = await this.request<{
      allowedTypes: string[];
      templates: Record<
        string,
        Array<{ name: string; description: string; maxParticipants: number }>
      >;
    }>("/events/templates");

    if (response.data) {
      return response.data;
    }
    throw new Error(response.message || "Failed to load event templates");
  }

  // Programs API
  async listPrograms(params?: { type?: string; q?: string }): Promise<
    Array<{
      id: string;
      title: string;
      programType: "EMBA Mentor Circles" | "Effective Communication Workshops";
      hostedBy?: string;
      period?: {
        startYear?: string;
        startMonth?: string;
        endYear?: string;
        endMonth?: string;
      };
      introduction?: string;
      flyerUrl?: string;
      earlyBirdDeadline?: string;
      isFree?: boolean;
      mentors?: Array<{
        userId: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        gender?: "male" | "female";
        avatar?: string;
        roleInAtCloud?: string;
      }>;
      mentorsByCircle?: {
        E?: Array<{
          userId: string;
          firstName?: string;
          lastName?: string;
          email?: string;
          gender?: "male" | "female";
          avatar?: string;
          roleInAtCloud?: string;
        }>;
        M?: Array<{
          userId: string;
          firstName?: string;
          lastName?: string;
          email?: string;
          gender?: "male" | "female";
          avatar?: string;
          roleInAtCloud?: string;
        }>;
        B?: Array<{
          userId: string;
          firstName?: string;
          lastName?: string;
          email?: string;
          gender?: "male" | "female";
          avatar?: string;
          roleInAtCloud?: string;
        }>;
        A?: Array<{
          userId: string;
          firstName?: string;
          lastName?: string;
          email?: string;
          gender?: "male" | "female";
          avatar?: string;
          roleInAtCloud?: string;
        }>;
      };
      fullPriceTicket: number;
      classRepDiscount?: number;
      earlyBirdDiscount?: number;
      events?: string[];
      createdBy: string;
      createdAt: string;
      updatedAt: string;
    }>
  > {
    const res = await this.request<unknown>(
      `/programs${
        params && (params.type || params.q)
          ? `?${new URLSearchParams(
              Object.entries(params).reduce((acc, [k, v]) => {
                if (v != null && v !== "") acc[k] = String(v);
                return acc;
              }, {} as Record<string, string>)
            ).toString()}`
          : ""
      }`
    );
    type MentorLite = {
      userId: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      gender?: "male" | "female";
      avatar?: string;
      roleInAtCloud?: string;
    };
    type ProgramDTO = {
      id: string;
      title: string;
      programType: "EMBA Mentor Circles" | "Effective Communication Workshops";
      hostedBy?: string;
      period?: {
        startYear?: string;
        startMonth?: string;
        endYear?: string;
        endMonth?: string;
      };
      introduction?: string;
      flyerUrl?: string;
      earlyBirdDeadline?: string;
      isFree?: boolean;
      mentors?: MentorLite[];
      mentorsByCircle?: {
        E?: MentorLite[];
        M?: MentorLite[];
        B?: MentorLite[];
        A?: MentorLite[];
      };
      fullPriceTicket: number;
      classRepDiscount?: number;
      earlyBirdDiscount?: number;
      events?: string[];
      createdBy: string;
      createdAt: string;
      updatedAt: string;
    };
    // Backend returns { success, data: ProgramDTO[] }, and request() already
    // unwraps to place the array on res.data. Return the array directly.
    return (res.data as ProgramDTO[]) || [];
  }

  async getProgram(id: string): Promise<unknown> {
    const res = await this.request<unknown>(`/programs/${id}`);
    return (res as { data?: unknown }).data;
  }

  async createProgram(payload: unknown): Promise<unknown> {
    const res = await this.request<unknown>(`/programs`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return (res as { data?: unknown }).data;
  }

  async updateProgram(id: string, payload: unknown): Promise<unknown> {
    const res = await this.request<unknown>(`/programs/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return (res as { data?: unknown }).data;
  }

  async deleteProgram(
    id: string,
    options?: { deleteLinkedEvents?: boolean }
  ): Promise<{
    message: string;
    unlinkedEvents?: number;
    deletedEvents?: number;
    deletedRegistrations?: number;
    deletedGuestRegistrations?: number;
  }> {
    const qs = options?.deleteLinkedEvents ? "?deleteLinkedEvents=true" : "";
    const res = await this.request<{
      message: string;
      unlinkedEvents?: number;
      deletedEvents?: number;
      deletedRegistrations?: number;
      deletedGuestRegistrations?: number;
    }>(`/programs/${id}${qs}`, { method: "DELETE" });
    return res.data || { message: "Program deleted successfully" };
  }

  async listProgramEvents(id: string): Promise<unknown[]> {
    const res = await this.request<unknown>(`/programs/${id}/events`);
    return ((res as { data?: unknown[] }).data as unknown[]) || [];
  }

  // Paged program events (server-side pagination)
  async listProgramEventsPaged(
    id: string,
    params: {
      page?: number;
      limit?: number;
      sort?: "date:asc" | "date:desc";
      type?: string;
      status?: string;
    } = {}
  ): Promise<{
    items: unknown[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    sort?: { field: string; dir: "asc" | "desc" };
    filters?: { type?: string; status?: string };
  }> {
    const search = new URLSearchParams();
    if (params.page != null) search.set("page", String(params.page));
    if (params.limit != null) search.set("limit", String(params.limit));
    if (params.sort) search.set("sort", params.sort);
    if (params.type) search.set("type", params.type);
    if (params.status) search.set("status", params.status);
    const qs = search.toString();
    const res = await this.request<unknown>(
      `/programs/${id}/events${qs ? `?${qs}` : ""}`
    );
    const data = (
      res as {
        data?: {
          items?: unknown[];
          page?: number;
          limit?: number;
          total?: number;
          totalPages?: number;
          sort?: { field: string; dir: "asc" | "desc" };
          filters?: { type?: string; status?: string };
        };
      }
    ).data;
    return {
      items: data?.items || [],
      page: data?.page ?? params.page ?? 1,
      limit: data?.limit ?? params.limit ?? 20,
      total: data?.total ?? (data?.items?.length || 0),
      totalPages:
        data?.totalPages ??
        Math.max(
          1,
          Math.ceil((data?.total ?? 0) / (data?.limit ?? params.limit ?? 20))
        ),
      sort: data?.sort,
      filters: data?.filters,
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;

    // helper to construct headers and config with current token
    const buildConfig = (): RequestInit => {
      const token = localStorage.getItem("authToken");
      const defaultHeaders: HeadersInit = {};
      if (!(options.body instanceof FormData)) {
        defaultHeaders["Content-Type"] = "application/json";
      }
      if (token) {
        defaultHeaders.Authorization = `Bearer ${token}`;
      }
      return {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers,
        },
        credentials: "include",
      };
    };

    // Some bodies (FormData/streams) are one-shot; clone FormData for safe retry
    const cloneBodyIfNeeded = (body: BodyInit | null | undefined) => {
      if (body instanceof FormData) {
        const fd = new FormData();
        body.forEach((value, key) => {
          if (value instanceof Blob) {
            fd.append(key, value, (value as File).name);
          } else {
            fd.append(key, value as string);
          }
        });
        return fd as BodyInit;
      }
      return body;
    };

    // First attempt
    const config = buildConfig();

    try {
      let response = await fetch(url, config);
      let data: ApiResponse<T>;
      try {
        data = (await response.json()) as ApiResponse<T>;
      } catch {
        // Non-JSON response
        data = {
          success: response.ok,
          message: response.statusText,
        } as ApiResponse<T>;
      }

      if (!response.ok) {
        // Attempt automatic refresh on 401 (skip for refresh endpoint itself)
        if (
          response.status === 401 &&
          !endpoint.includes("/auth/refresh-token")
        ) {
          try {
            await this.refreshToken();
            // rebuild config with new token and retry once
            const retryOptions: RequestInit = {
              ...options,
              body: cloneBodyIfNeeded(
                options.body as BodyInit | null | undefined
              ),
            };
            const retryConfig: RequestInit = {
              ...retryOptions,
              headers: {
                ...(retryOptions.headers || {}),
              },
              credentials: "include",
            };
            // Merge auth headers freshly
            const token = localStorage.getItem("authToken");
            const hdrs: HeadersInit = {};
            if (!(retryOptions.body instanceof FormData)) {
              hdrs["Content-Type"] = "application/json";
            }
            if (token) hdrs.Authorization = `Bearer ${token}`;
            retryConfig.headers = { ...hdrs, ...(retryOptions.headers || {}) };

            response = await fetch(url, retryConfig);
            try {
              data = (await response.json()) as ApiResponse<T>;
            } catch {
              data = {
                success: response.ok,
                message: response.statusText,
              } as ApiResponse<T>;
            }

            if (response.ok) return data;
          } catch {
            // Refresh failed; clear token and trigger session expiration prompt
            localStorage.removeItem("authToken");
            handleSessionExpired();
          }
        }

        // For validation errors, include detailed error information
        if (
          response.status === 400 &&
          data?.errors &&
          Array.isArray(data.errors)
        ) {
          const errorMessages = (data.errors as unknown[])
            .map((err: unknown) => {
              if (typeof err === "string") return err;
              if (
                err &&
                typeof err === "object" &&
                ("path" in err ||
                  "param" in err ||
                  "msg" in err ||
                  "message" in err)
              ) {
                const e = err as {
                  path?: string;
                  param?: string;
                  msg?: string;
                  message?: string;
                };
                const field = e.path || e.param || "field";
                const message = e.msg || e.message || "validation error";
                return `${field}: ${message}`;
              }
              return "validation error";
            })
            .join("; ");
          const err = new Error(
            `${data.message || "Validation failed"}: ${errorMessages}`
          ) as Error & {
            status?: number;
          };
          err.status = response.status;
          throw err;
        }

        const err = new Error(
          data?.message || `HTTP ${response.status}`
        ) as Error & { status?: number };
        err.status = response.status;
        if (err.status === 401) {
          // Fallback path if we landed here without triggering above branch
          handleSessionExpired();
        }
        throw err;
      }

      return data;
    } catch (error) {
      console.error("API Request failed:", error);
      if (error instanceof Error) {
        return Promise.reject(error);
      }
      return Promise.reject(new Error("Network error"));
    }
  }

  // Public endpoints: Role assignment rejection flow (token-based)
  async validateAssignmentRejection(token: string): Promise<
    ApiResponse<{
      event?: {
        id: string;
        title?: string;
        date?: string;
        time?: string;
        roleName?: string;
      };
      role?: string;
    }>
  > {
    return this.request(
      `/role-assignments/reject/validate?token=${encodeURIComponent(token)}`
    );
  }

  async rejectAssignment(
    token: string,
    note: string
  ): Promise<ApiResponse<{ status: string }>> {
    return this.request(`/role-assignments/reject/reject`, {
      method: "POST",
      body: JSON.stringify({ token, note }),
    });
  }

  // Authentication endpoints
  async login(
    emailOrUsername: string,
    password: string,
    rememberMe?: boolean
  ): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        emailOrUsername,
        password,
        rememberMe,
      }),
    });

    if (response.data) {
      // Store token in localStorage
      localStorage.setItem("authToken", response.data.accessToken);
      return response.data;
    }

    throw new Error(response.message || "Login failed");
  }

  async register(userData: {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
    firstName?: string;
    lastName?: string;
    gender?: "male" | "female";
    isAtCloudLeader: boolean;
    roleInAtCloud?: string;
    occupation?: string;
    company?: string;
    weeklyChurch?: string;
    homeAddress?: string;
    phone?: string;
    churchAddress?: string;
    acceptTerms: boolean;
  }): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    });

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Registration failed");
  }

  async logout(): Promise<void> {
    try {
      await this.request("/auth/logout", {
        method: "POST",
      });
    } finally {
      localStorage.removeItem("authToken");
    }
  }

  async getProfile(): Promise<AuthResponse["user"]> {
    const response = await this.request<{ user: AuthResponse["user"] }>(
      "/auth/profile"
    );

    if (response.data) {
      return response.data.user;
    }

    throw new Error(response.message || "Failed to get profile");
  }

  async refreshToken(): Promise<AuthTokens> {
    const url = `${this.baseURL}/auth/refresh-token`;
    const resp = await fetch(url, {
      method: "POST",
      credentials: "include",
    });
    const raw: unknown = await resp.json();
    const data = raw as Partial<ApiResponse<AuthTokens>> &
      Partial<AuthTokens> & {
        data?: Partial<AuthTokens>;
        message?: string;
      };
    if (!resp.ok) {
      throw new Error(data?.message || `HTTP ${resp.status}`);
    }
    const token = data.accessToken || data?.data?.accessToken;
    if (token) {
      localStorage.setItem("authToken", token);
      const expiresAt =
        data.expiresAt ||
        data?.data?.expiresAt ||
        new Date(Date.now() + 55 * 60 * 1000).toISOString();
      return { accessToken: token, expiresAt };
    }
    throw new Error(data?.message || "Token refresh failed");
  }

  async verifyEmail(token: string): Promise<void> {
    await this.request(`/auth/verify-email/${token}`);
  }

  async resendVerification(email: string): Promise<void> {
    await this.request("/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async forgotPassword(email: string): Promise<void> {
    await this.request("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(
    token: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<void> {
    await this.request("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, newPassword, confirmPassword }),
    });
  }

  // Event endpoints
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
    eventData: UpdateEventPayload
  ): Promise<EventData> {
    const response = await this.request<{ event: EventData }>(
      `/events/${eventId}`,
      {
        method: "PUT",
        body: JSON.stringify(eventData),
      }
    );

    if (response.data) {
      return response.data.event;
    }

    throw new Error(response.message || "Failed to update event");
  }

  async updateWorkshopGroupTopic(
    eventId: string,
    group: "A" | "B" | "C" | "D" | "E" | "F",
    topic: string
  ): Promise<EventData> {
    const response = await this.request<{ event: EventData }>(
      `/events/${eventId}/workshop/groups/${group}/topic`,
      {
        method: "POST",
        body: JSON.stringify({ topic }),
      }
    );
    if (response.data) return response.data.event;
    throw new Error(response.message || "Failed to update group topic");
  }

  async deleteEvent(eventId: string): Promise<void> {
    await this.request(`/events/${eventId}`, {
      method: "DELETE",
    });
  }

  async getEventParticipants(eventId: string): Promise<EventParticipant[]> {
    const response = await this.request<{ participants: EventParticipant[] }>(
      `/events/${eventId}/participants`
    );

    if (response.data) {
      return response.data.participants;
    }

    throw new Error(response.message || "Failed to get event participants");
  }

  async sendEventEmails(
    eventId: string,
    payload: {
      subject: string;
      bodyHtml: string;
      bodyText?: string;
      includeGuests?: boolean;
      includeUsers?: boolean;
    }
  ): Promise<{ recipientCount: number; sent?: number }> {
    type EmailResult = { recipientCount: number; sent?: number };
    const response = await this.request<EmailResult>(
      `/events/${eventId}/email`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
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

  async signUpForEvent(
    eventId: string,
    roleId: string,
    notes?: string,
    specialRequirements?: string
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
      }
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
      }
    );

    if (response.data) {
      return response.data.event;
    }

    throw new Error(response.message || "Failed to cancel signup");
  }

  async removeUserFromRole(
    eventId: string,
    userId: string,
    roleId: string
  ): Promise<EventData> {
    const response = await this.request<{ event: EventData }>(
      `/events/${eventId}/manage/remove-user`,
      {
        method: "POST",
        body: JSON.stringify({
          userId,
          roleId,
        }),
      }
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
    toRoleId: string
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
      }
    );

    if (response.data) {
      return response.data.event;
    }

    throw new Error(response.message || "Failed to move user between roles");
  }

  async moveGuestBetweenRoles(
    eventId: string,
    guestRegistrationId: string,
    fromRoleId: string,
    toRoleId: string
  ): Promise<EventData> {
    const response = await this.request<{ event: EventData }>(
      `/events/${eventId}/manage/move-guest`,
      {
        method: "POST",
        body: JSON.stringify({
          guestRegistrationId,
          fromRoleId,
          toRoleId,
        }),
      }
    );

    if (response.data) {
      return response.data.event;
    }

    throw new Error(response.message || "Failed to move guest between roles");
  }

  async assignUserToRole(
    eventId: string,
    userId: string,
    roleId: string,
    notes?: string,
    sendNotifications?: boolean
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
      }
    );

    if (response.data) {
      return response.data.event;
    }

    throw new Error(response.message || "Failed to assign user to role");
  }

  async updateEventStatuses(): Promise<{ updatedCount: number }> {
    const response = await this.request<{ updatedCount: number }>(
      "/events/update-statuses",
      {
        method: "POST",
      }
    );

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to update event statuses");
  }

  // User endpoints
  async getUserEvents(
    page?: number,
    limit?: number
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
      "/events/user/created"
    );

    if (response.data) {
      return response.data.events;
    }

    throw new Error(response.message || "Failed to get created events");
  }

  // User management endpoints
  async getUsers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    isActive?: boolean;
    emailVerified?: boolean;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }): Promise<{
    users: AppUser[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalUsers: number;
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

    const endpoint = `/users${
      queryParams.toString() ? `?${queryParams.toString()}` : ""
    }`;
    const response = await this.request<{
      users: AppUser[];
      pagination: {
        currentPage: number;
        totalPages: number;
        totalUsers: number;
        hasNext: boolean;
        hasPrev: boolean;
      };
    }>(endpoint);

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to get users");
  }

  async getUser(id: string): Promise<AppUser> {
    const response = await this.request<{ user: AppUser }>(`/users/${id}`);

    if (response.data) {
      return response.data.user;
    }

    throw new Error(response.message || "Failed to get user");
  }

  async updateProfile(updates: unknown): Promise<AppUser> {
    const response = await this.request<{ user: AppUser }>("/users/profile", {
      method: "PUT",
      body: JSON.stringify(updates),
    });

    if (response.data) {
      return response.data.user;
    }

    throw new Error(response.message || "Failed to update profile");
  }

  async getUserStats(): Promise<unknown> {
    const response = await this.request<unknown>("/users/stats");

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to get user stats");
  }

  async updateUserRole(userId: string, role: string): Promise<AppUser> {
    const response = await this.request<{ user: AppUser }>(
      `/users/${userId}/role`,
      {
        method: "PUT",
        body: JSON.stringify({ role }),
      }
    );

    if (response.data) {
      return response.data.user;
    }

    throw new Error(response.message || "Failed to update user role");
  }

  async deleteUser(userId: string): Promise<void> {
    await this.request(`/users/${userId}`, {
      method: "DELETE",
    });
  }

  // New secure password change methods
  async requestPasswordChange(
    currentPassword: string,
    newPassword: string
  ): Promise<{ message: string }> {
    return await this.request("/auth/request-password-change", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async completePasswordChange(token: string): Promise<{ message: string }> {
    return await this.request(`/auth/complete-password-change/${token}`, {
      method: "POST",
    });
  }

  async deactivateUser(userId: string): Promise<void> {
    await this.request(`/users/${userId}/deactivate`, {
      method: "PUT",
    });
  }

  async reactivateUser(userId: string): Promise<void> {
    await this.request(`/users/${userId}/reactivate`, {
      method: "PUT",
    });
  }

  // File upload endpoints
  async uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
    const formData = new FormData();
    formData.append("avatar", file);

    const response = await this.request<{ avatarUrl: string }>(
      "/users/avatar",
      {
        method: "POST",
        body: formData,
      }
    );

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to upload avatar");
  }

  async uploadGenericImage(file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append("image", file);

    const response = await this.request<{ url: string }>("/uploads/image", {
      method: "POST",
      body: formData,
    });

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to upload image");
  }

  // Notification endpoints
  async getNotifications(): Promise<Notification[]> {
    const response = await this.request<{ notifications: Notification[] }>(
      "/notifications"
    );

    if (response.data) {
      return response.data.notifications;
    }

    throw new Error(response.message || "Failed to get notifications");
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    await this.request(`/notifications/${notificationId}/read`, {
      method: "PUT",
    });
  }

  async markAllNotificationsAsRead(): Promise<void> {
    // Deprecated legacy endpoint replaced with bell-only endpoint
    // Only mark BELL notifications as read; system messages are independent
    await this.request("/notifications/bell/read-all", {
      method: "PATCH",
    });
  }

  async deleteNotification(notificationId: string): Promise<void> {
    await this.request(`/notifications/${notificationId}`, {
      method: "DELETE",
    });
  }

  async clearAllNotifications(): Promise<void> {
    await this.request("/notifications", {
      method: "DELETE",
    });
  }

  async createNotification(notificationData: unknown): Promise<Notification> {
    const response = await this.request<{ notification: Notification }>(
      "/notifications",
      {
        method: "POST",
        body: JSON.stringify(notificationData),
      }
    );

    if (response.data) {
      return response.data.notification;
    }

    throw new Error(response.message || "Failed to create notification");
  }

  async sendBulkNotification(notificationData: unknown): Promise<number> {
    const response = await this.request<{ count: number }>(
      "/notifications/bulk",
      {
        method: "POST",
        body: JSON.stringify(notificationData),
      }
    );

    if (response.data) {
      return response.data.count;
    }

    throw new Error(response.message || "Failed to send bulk notification");
  }

  // System Message endpoints (NEW unified notifications API)
  async getSystemMessages(): Promise<SystemMessage[]> {
    const response = await this.request<{ systemMessages: SystemMessage[] }>(
      "/notifications/system"
    );

    if (response.data) {
      return response.data.systemMessages;
    }

    throw new Error(response.message || "Failed to get system messages");
  }

  async getSystemMessageUnreadCount(): Promise<number> {
    const response = await this.request<{ unreadCount: number }>(
      "/notifications/unread-counts"
    );

    if (response.data) {
      return response.data.unreadCount;
    }

    throw new Error(response.message || "Failed to get unread count");
  }

  async checkWelcomeMessageStatus(): Promise<boolean> {
    const response = await this.request<{ hasReceivedWelcomeMessage: boolean }>(
      "/notifications/welcome-status"
    );

    if (response.data) {
      return response.data.hasReceivedWelcomeMessage;
    }

    throw new Error(
      response.message || "Failed to check welcome message status"
    );
  }

  async sendWelcomeNotification(): Promise<void> {
    const response = await this.request<ApiResponse<unknown>>(
      "/notifications/welcome",
      {
        method: "POST",
      }
    );

    if (!response.success) {
      throw new Error(
        response.message || "Failed to send welcome notification"
      );
    }
  }

  async markSystemMessageAsRead(
    messageId: string
  ): Promise<ApiResponse<unknown>> {
    const response = await this.request<ApiResponse<unknown>>(
      `/notifications/system/${messageId}/read`,
      {
        method: "PATCH", // Standardized to PATCH for consistency
      }
    );

    if (response.success) {
      return response;
    }

    throw new Error(response.message || "Failed to mark message as read");
  }

  async markAllSystemMessagesAsRead(): Promise<ApiResponse<unknown>> {
    // This method is for BELL notifications "mark all as read", not system messages
    // System messages don't have a "mark all as read" feature by design
    // Redirecting to the correct bell notifications endpoint
    const response = await this.request<ApiResponse<unknown>>(
      "/notifications/bell/read-all",
      {
        method: "PATCH",
      }
    );

    if (!response.success) {
      throw new Error(
        response.message || "Failed to mark all bell notifications as read"
      );
    }

    return response;
  }

  async createSystemMessage(message: unknown): Promise<ApiResponse<unknown>> {
    const response = await this.request<ApiResponse<unknown>>(
      "/system-messages",
      {
        method: "POST",
        body: JSON.stringify(message),
      }
    );

    if (response.success) {
      return response;
    }

    throw new Error(response.message || "Failed to create system message");
  }

  async createAutoSystemMessage(
    message: unknown
  ): Promise<ApiResponse<unknown>> {
    const response = await this.request<ApiResponse<unknown>>(
      "/system-messages/auto",
      {
        method: "POST",
        body: JSON.stringify(message),
      }
    );

    if (response.success) {
      return response;
    }

    throw new Error(response.message || "Failed to create auto system message");
  }

  async deleteSystemMessage(messageId: string): Promise<ApiResponse<unknown>> {
    const response = await this.request<ApiResponse<unknown>>(
      `/system-messages/${messageId}`,
      {
        method: "DELETE",
      }
    );

    if (response.success) {
      return response;
    }

    throw new Error(response.message || "Failed to delete system message");
  }

  // Message endpoints
  async getMessages(params: {
    eventId?: string;
    receiverId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ messages: unknown[]; pagination?: unknown }> {
    const queryParams = new URLSearchParams();
    if (params.eventId) queryParams.append("eventId", params.eventId);
    if (params.receiverId) queryParams.append("receiverId", params.receiverId);
    if (params.page) queryParams.append("page", params.page.toString());
    if (params.limit) queryParams.append("limit", params.limit.toString());

    const response = await this.request<{
      messages: unknown[];
      pagination?: unknown;
    }>(`/messages?${queryParams.toString()}`);

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to fetch messages");
  }

  async sendMessage(messageData: {
    content: string;
    eventId?: string;
    receiverId?: string;
    messageType?: string;
    parentMessageId?: string;
    mentions?: string[];
    priority?: string;
    tags?: string[];
  }): Promise<unknown> {
    const response = await this.request<{ message: unknown }>("/messages", {
      method: "POST",
      body: JSON.stringify(messageData),
    });

    if (response.data) {
      return response.data.message;
    }

    throw new Error(response.message || "Failed to send message");
  }

  async editMessage(messageId: string, content: string): Promise<unknown> {
    const response = await this.request<{ message: unknown }>(
      `/messages/${messageId}`,
      {
        method: "PUT",
        body: JSON.stringify({ content }),
      }
    );

    if (response.data) {
      return response.data.message;
    }

    throw new Error(response.message || "Failed to edit message");
  }

  async deleteMessage(messageId: string): Promise<boolean> {
    const response = await this.request<ApiResponse<unknown>>(
      `/messages/${messageId}`,
      {
        method: "DELETE",
      }
    );

    return response.success;
  }

  async addReaction(messageId: string, emoji: string): Promise<unknown> {
    const response = await this.request<{ message: unknown }>(
      `/messages/${messageId}/reactions`,
      {
        method: "POST",
        body: JSON.stringify({ emoji }),
      }
    );

    if (response.data) {
      return response.data.message;
    }

    throw new Error(response.message || "Failed to add reaction");
  }

  // Analytics endpoints
  async getAnalytics(): Promise<unknown> {
    const response = await this.request<unknown>("/analytics");

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to get analytics");
  }

  async getUserAnalytics(): Promise<unknown> {
    const response = await this.request<unknown>("/analytics/users");

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to get user analytics");
  }

  async getEventAnalytics(): Promise<unknown> {
    const response = await this.request<unknown>("/analytics/events");

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to get event analytics");
  }

  async getEngagementAnalytics(): Promise<unknown> {
    const response = await this.request<unknown>("/analytics/engagement");

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to get engagement analytics");
  }

  async exportAnalytics(
    format: "csv" | "xlsx" | "json" = "csv"
  ): Promise<Blob> {
    const response = await fetch(
      `${this.baseURL}/analytics/export?format=${format}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to export analytics");
    }

    return response.blob();
  }

  // Search endpoints
  async searchUsers(
    query: string,
    filters?: Record<string, string | number | boolean | null | undefined>
  ): Promise<{ results: AppUser[]; pagination?: unknown }> {
    const queryParams = new URLSearchParams({ q: query });
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const response = await this.request<{
      results: AppUser[];
      pagination?: unknown;
    }>(`/search/users?${queryParams.toString()}`);

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to search users");
  }

  async searchEvents(
    query: string,
    filters?: Record<string, string | number | boolean | null | undefined>
  ): Promise<{ results: EventData[]; pagination?: unknown }> {
    const queryParams = new URLSearchParams({ q: query });
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const response = await this.request<{
      results: EventData[];
      pagination?: unknown;
    }>(`/search/events?${queryParams.toString()}`);

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to search events");
  }

  async globalSearch(query: string): Promise<{
    users?: AppUser[];
    events?: EventData[];
    messages?: unknown[];
  }> {
    const response = await this.request<{
      users?: AppUser[];
      events?: EventData[];
      messages?: unknown[];
    }>(`/search/global?q=${encodeURIComponent(query)}`);

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to perform global search");
  }

  // Feedback endpoint
  async submitFeedback(feedbackData: {
    type: string;
    subject: string;
    message: string;
    includeContact?: boolean;
  }): Promise<void> {
    await this.request("/feedback", {
      method: "POST",
      body: JSON.stringify(feedbackData),
    });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export individual service functions for convenience
export const authService = {
  login: (emailOrUsername: string, password: string, rememberMe?: boolean) =>
    apiClient.login(emailOrUsername, password, rememberMe),
  register: (userData: Parameters<typeof apiClient.register>[0]) =>
    apiClient.register(userData),
  logout: () => apiClient.logout(),
  getProfile: () => apiClient.getProfile(),
  refreshToken: () => apiClient.refreshToken(),
  verifyEmail: (token: string) => apiClient.verifyEmail(token),
  resendVerification: (email: string) => apiClient.resendVerification(email),
  forgotPassword: (email: string) => apiClient.forgotPassword(email),
  resetPassword: (
    token: string,
    newPassword: string,
    confirmPassword: string
  ) => apiClient.resetPassword(token, newPassword, confirmPassword),
};

export const eventService = {
  getEvents: (params?: Parameters<typeof apiClient.getEvents>[0]) =>
    apiClient.getEvents(params),
  getEvent: (id: string) => apiClient.getEvent(id),
  createEvent: (eventData: unknown) => apiClient.createEvent(eventData),
  updateEvent: (eventId: string, eventData: UpdateEventPayload) =>
    apiClient.updateEvent(eventId, eventData),
  checkTimeConflict: (
    params: Parameters<typeof apiClient.checkEventTimeConflict>[0]
  ) => apiClient.checkEventTimeConflict(params),
  updateWorkshopGroupTopic: (
    eventId: string,
    group: "A" | "B" | "C" | "D" | "E" | "F",
    topic: string
  ) => apiClient.updateWorkshopGroupTopic(eventId, group, topic),
  deleteEvent: (eventId: string) => apiClient.deleteEvent(eventId),
  getEventParticipants: (eventId: string) =>
    apiClient.getEventParticipants(eventId),
  sendEventEmails: (
    eventId: string,
    payload: Parameters<typeof apiClient.sendEventEmails>[1]
  ) => apiClient.sendEventEmails(eventId, payload),
  signUpForEvent: (
    eventId: string,
    roleId: string,
    notes?: string,
    specialRequirements?: string
  ) => apiClient.signUpForEvent(eventId, roleId, notes, specialRequirements),
  cancelSignup: (eventId: string, roleId: string) =>
    apiClient.cancelEventSignup(eventId, roleId),
  removeUserFromRole: (eventId: string, userId: string, roleId: string) =>
    apiClient.removeUserFromRole(eventId, userId, roleId),
  moveUserBetweenRoles: (
    eventId: string,
    userId: string,
    fromRoleId: string,
    toRoleId: string
  ) => apiClient.moveUserBetweenRoles(eventId, userId, fromRoleId, toRoleId),
  moveGuestBetweenRoles: (
    eventId: string,
    guestRegistrationId: string,
    fromRoleId: string,
    toRoleId: string
  ) =>
    apiClient.moveGuestBetweenRoles(
      eventId,
      guestRegistrationId,
      fromRoleId,
      toRoleId
    ),
  assignUserToRole: (
    eventId: string,
    userId: string,
    roleId: string,
    notes?: string,
    sendNotifications?: boolean
  ) =>
    apiClient.assignUserToRole(
      eventId,
      userId,
      roleId,
      notes,
      sendNotifications
    ),
  updateEventStatuses: () => apiClient.updateEventStatuses(),
  getUserEvents: (page?: number, limit?: number) =>
    apiClient.getUserEvents(page, limit),
  getCreatedEvents: () => apiClient.getCreatedEvents(),
  getEventTemplates: () => apiClient.getEventTemplates(),
};

export const userService = {
  getProfile: () => apiClient.getProfile(),
  updateProfile: (updates: unknown) => apiClient.updateProfile(updates),
  getUsers: (params?: Parameters<typeof apiClient.getUsers>[0]) =>
    apiClient.getUsers(params),
  getUser: (id: string) => apiClient.getUser(id),
  getUserStats: () => apiClient.getUserStats(),
  updateUserRole: (userId: string, role: string) =>
    apiClient.updateUserRole(userId, role),
  deleteUser: (userId: string) => apiClient.deleteUser(userId),
  // New secure password change methods
  requestPasswordChange: (currentPassword: string, newPassword: string) =>
    apiClient.requestPasswordChange(currentPassword, newPassword),
  completePasswordChange: (token: string) =>
    apiClient.completePasswordChange(token),
  deactivateUser: (userId: string) => apiClient.deactivateUser(userId),
  reactivateUser: (userId: string) => apiClient.reactivateUser(userId),
};

export const notificationService = {
  getNotifications: () => apiClient.getNotifications(),
  markAsRead: (notificationId: string) =>
    apiClient.markNotificationAsRead(notificationId),
  markAllAsRead: () => apiClient.markAllNotificationsAsRead(),
  deleteNotification: (notificationId: string) =>
    apiClient.deleteNotification(notificationId),
  clearAll: () => apiClient.clearAllNotifications(),
  createNotification: (data: unknown) => apiClient.createNotification(data),
  sendBulkNotification: (data: unknown) => apiClient.sendBulkNotification(data),
};

export const messageService = {
  getMessages: (params: Parameters<typeof apiClient.getMessages>[0]) =>
    apiClient.getMessages(params),
  sendMessage: (messageData: Parameters<typeof apiClient.sendMessage>[0]) =>
    apiClient.sendMessage(messageData),
  editMessage: (messageId: string, content: string) =>
    apiClient.editMessage(messageId, content),
  deleteMessage: (messageId: string) => apiClient.deleteMessage(messageId),
  addReaction: (messageId: string, emoji: string) =>
    apiClient.addReaction(messageId, emoji),
};

export const fileService = {
  uploadAvatar: (file: File) => apiClient.uploadAvatar(file),
  uploadImage: (file: File) => apiClient.uploadGenericImage(file),
};

export const analyticsService = {
  getAnalytics: () => apiClient.getAnalytics(),
  getUserAnalytics: () => apiClient.getUserAnalytics(),
  getEventAnalytics: () => apiClient.getEventAnalytics(),
  getEngagementAnalytics: () => apiClient.getEngagementAnalytics(),
  exportAnalytics: (format?: "csv" | "xlsx" | "json") =>
    apiClient.exportAnalytics(format),
};

export const programService = {
  list: (params?: Parameters<typeof apiClient.listPrograms>[0]) =>
    apiClient.listPrograms(params),
  getById: (id: string) => apiClient.getProgram(id),
  create: (payload: unknown) => apiClient.createProgram(payload),
  update: (id: string, payload: unknown) =>
    apiClient.updateProgram(id, payload),
  remove: (
    id: string,
    options?: Parameters<typeof apiClient.deleteProgram>[1]
  ) => apiClient.deleteProgram(id, options),
  listEvents: (id: string) => apiClient.listProgramEvents(id),
  listEventsPaged: (
    id: string,
    params?: Parameters<typeof apiClient.listProgramEventsPaged>[1]
  ) => apiClient.listProgramEventsPaged(id, params),
};

export const searchService = {
  searchUsers: (
    query: string,
    filters?: Parameters<typeof apiClient.searchUsers>[1]
  ) => apiClient.searchUsers(query, filters),
  searchEvents: (
    query: string,
    filters?: Parameters<typeof apiClient.searchEvents>[1]
  ) => apiClient.searchEvents(query, filters),
  globalSearch: (query: string) => apiClient.globalSearch(query),
};

export const systemMessageService = {
  getSystemMessages: () => apiClient.getSystemMessages(),
  getUnreadCount: () => apiClient.getSystemMessageUnreadCount(),
  checkWelcomeMessageStatus: () => apiClient.checkWelcomeMessageStatus(),
  sendWelcomeNotification: () => apiClient.sendWelcomeNotification(),
  markAsRead: (messageId: string) =>
    apiClient.markSystemMessageAsRead(messageId),
  markAllAsRead: () => apiClient.markAllSystemMessagesAsRead(),
  createSystemMessage: (message: unknown) =>
    apiClient.createSystemMessage(message),
  createAutoSystemMessage: (message: unknown) =>
    apiClient.createAutoSystemMessage(message),
  deleteSystemMessage: (messageId: string) =>
    apiClient.deleteSystemMessage(messageId),
};

// Role assignment rejection (public, token-based)
export const assignmentService = {
  validateRejection: (token: string) =>
    apiClient.validateAssignmentRejection(token),
  submitRejection: (token: string, note: string) =>
    apiClient.rejectAssignment(token, note),
};

export default apiClient;
