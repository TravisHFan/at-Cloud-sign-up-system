// API Configuration
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5001/api/v1";

// API Response Types
export interface ApiResponse<T = any> {
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
    firstName?: string;
    lastName?: string;
    role: string;
    isAtCloudLeader: boolean;
    roleInAtCloud?: string;
    avatar?: string;
    lastLogin?: string;
  };
  accessToken: string;
  expiresAt: string;
}

// API Client Class
class ApiClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;

    // Get auth token from localStorage
    const token = localStorage.getItem("authToken");

    const defaultHeaders: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (token) {
      defaultHeaders.Authorization = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      credentials: "include", // Include cookies for refresh tokens
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        // Handle 401 errors (token expired)
        if (response.status === 401) {
          localStorage.removeItem("authToken");
          // Could trigger a refresh token attempt here
        }

        throw new Error(data.message || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error("API Request failed:", error);
      throw error instanceof Error ? error : new Error("Network error");
    }
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
    const response = await this.request<AuthTokens>("/auth/refresh-token", {
      method: "POST",
    });

    if (response.data) {
      localStorage.setItem("authToken", response.data.accessToken);
      return response.data;
    }

    throw new Error(response.message || "Token refresh failed");
  }

  // Event endpoints
  async getEvents(params?: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    category?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }): Promise<{
    events: any[];
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
      events: any[];
      pagination: any;
    }>(endpoint);

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to get events");
  }

  async getEvent(id: string): Promise<any> {
    const response = await this.request<{ event: any }>(`/events/${id}`);

    if (response.data) {
      return response.data.event;
    }

    throw new Error(response.message || "Failed to get event");
  }

  async createEvent(eventData: any): Promise<any> {
    const response = await this.request<{ event: any }>("/events", {
      method: "POST",
      body: JSON.stringify(eventData),
    });

    if (response.data) {
      return response.data.event;
    }

    throw new Error(response.message || "Failed to create event");
  }

  async signUpForEvent(
    eventId: string,
    roleId: string,
    notes?: string,
    specialRequirements?: string
  ): Promise<any> {
    const response = await this.request<{ event: any }>(
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

  async cancelEventSignup(eventId: string, roleId: string): Promise<any> {
    const response = await this.request<{ event: any }>(
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

  // User endpoints
  async getUserEvents(): Promise<any[]> {
    const response = await this.request<{ events: any[] }>(
      "/events/user/registered"
    );

    if (response.data) {
      return response.data.events;
    }

    throw new Error(response.message || "Failed to get user events");
  }

  async getCreatedEvents(): Promise<any[]> {
    const response = await this.request<{ events: any[] }>(
      "/events/user/created"
    );

    if (response.data) {
      return response.data.events;
    }

    throw new Error(response.message || "Failed to get created events");
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
};

export const eventService = {
  getEvents: (params?: Parameters<typeof apiClient.getEvents>[0]) =>
    apiClient.getEvents(params),
  getEvent: (id: string) => apiClient.getEvent(id),
  createEvent: (eventData: any) => apiClient.createEvent(eventData),
  signUpForEvent: (
    eventId: string,
    roleId: string,
    notes?: string,
    specialRequirements?: string
  ) => apiClient.signUpForEvent(eventId, roleId, notes, specialRequirements),
  cancelSignup: (eventId: string, roleId: string) =>
    apiClient.cancelEventSignup(eventId, roleId),
  getUserEvents: () => apiClient.getUserEvents(),
  getCreatedEvents: () => apiClient.getCreatedEvents(),
};

export default apiClient;
