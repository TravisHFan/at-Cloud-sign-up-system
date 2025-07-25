import { vi } from "vitest";

// Mock User Data
export const mockUser = {
  _id: "6750f8a123456789abcdef01",
  name: "John Doe",
  email: "john.doe@example.com",
  phone: "555-0123",
  role: "user" as const,
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
};

export const mockAdmin = {
  _id: "6750f8a123456789abcdef02",
  name: "Admin User",
  email: "admin@example.com",
  phone: "555-0456",
  role: "admin" as const,
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
};

// Mock Event Data
export const mockEvent = {
  _id: "6750f8a123456789abcdef03",
  title: "Test Event",
  description: "This is a test event description",
  date: new Date("2024-12-25T10:00:00.000Z"),
  location: "Test Location",
  maxParticipants: 50,
  isActive: true,
  createdBy: mockAdmin._id,
  roles: [
    {
      id: "role1",
      name: "Volunteer",
      description: "Help with event setup",
      maxPeople: 10,
      registeredUsers: [mockUser._id],
    },
    {
      id: "role2",
      name: "Coordinator",
      description: "Coordinate activities",
      maxPeople: 5,
      registeredUsers: [],
    },
  ],
  registrations: [
    {
      userId: mockUser._id,
      roleId: "role1",
      registeredAt: new Date("2024-01-01T00:00:00.000Z"),
    },
  ],
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
};

// Mock Authentication Token
export const mockToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzUwZjhhMTIzNDU2Nzg5YWJjZGVmMDEiLCJlbWFpbCI6ImpvaG4uZG9lQGV4YW1wbGUuY29tIiwicm9sZSI6InVzZXIiLCJpYXQiOjE2OTkwMDAwMDAsImV4cCI6MTY5OTAwMzYwMH0.test-signature";

// Mock API Responses
export const mockApiResponses = {
  login: {
    success: true,
    token: mockToken,
    user: mockUser,
    message: "Login successful",
  },

  register: {
    success: true,
    user: mockUser,
    message: "Registration successful",
  },

  events: {
    success: true,
    data: [mockEvent],
    pagination: {
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    },
  },

  eventDetail: {
    success: true,
    data: mockEvent,
  },

  signup: {
    success: true,
    message: "Successfully signed up for role",
    data: {
      event: mockEvent,
      registration: mockEvent.registrations[0],
    },
  },

  cancel: {
    success: true,
    message: "Successfully cancelled registration",
    data: mockEvent,
  },

  removeUser: {
    success: true,
    message: "User removed from role successfully",
    data: mockEvent,
  },

  moveUser: {
    success: true,
    message: "User moved between roles successfully",
    data: mockEvent,
  },
};

// Mock Fetch Implementation
export const createMockFetch = (responses: Record<string, any> = {}) => {
  return vi.fn().mockImplementation((url: string, options?: RequestInit) => {
    const method = options?.method || "GET";
    const urlPath = new URL(url, "http://localhost:5001").pathname;

    // Default responses based on URL patterns
    const defaultResponses: Record<string, any> = {
      "POST /api/auth/login": mockApiResponses.login,
      "POST /api/auth/register": mockApiResponses.register,
      "GET /api/events": mockApiResponses.events,
      "GET /api/events/": mockApiResponses.eventDetail,
      "POST /api/events/": mockApiResponses.signup,
      "DELETE /api/events/": mockApiResponses.cancel,
      "PUT /api/events/": mockApiResponses.removeUser,
      "PATCH /api/events/": mockApiResponses.moveUser,
      ...responses,
    };

    const matchingKey = Object.keys(defaultResponses).find(
      (k) => urlPath.startsWith(k.split(" ")[1]) && k.startsWith(method)
    );

    const responseData = matchingKey
      ? defaultResponses[matchingKey]
      : { success: false, message: "Not found" };

    return Promise.resolve({
      ok: responseData.success !== false,
      status: responseData.success !== false ? 200 : 400,
      statusText: responseData.success !== false ? "OK" : "Bad Request",
      json: () => Promise.resolve(responseData),
      text: () => Promise.resolve(JSON.stringify(responseData)),
      headers: new Headers({
        "content-type": "application/json",
      }),
    } as Response);
  });
};

// Mock localStorage with initial auth data
export const setupMockAuth = (user: any = mockUser, token = mockToken) => {
  const localStorageMock = {
    getItem: vi.fn((key: string) => {
      switch (key) {
        case "token":
          return token;
        case "user":
          return JSON.stringify(user);
        default:
          return null;
      }
    }),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };

  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    writable: true,
  });

  return localStorageMock;
};

// Mock React Router
export const mockNavigate = vi.fn();
export const mockLocation = {
  pathname: "/",
  search: "",
  hash: "",
  state: null,
};

export const mockRouterUtils = {
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
  useParams: () => ({ id: mockEvent._id }),
};

// Form validation test helpers
export const submitForm = async (form: HTMLFormElement) => {
  const submitEvent = new Event("submit", { bubbles: true, cancelable: true });
  form.dispatchEvent(submitEvent);
  await new Promise((resolve) => setTimeout(resolve, 0)); // Wait for async validation
};

export const fillFormField = (
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string
) => {
  element.focus();
  element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.blur();
};
