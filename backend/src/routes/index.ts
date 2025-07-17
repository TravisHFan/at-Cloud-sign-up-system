import { Router } from "express";
import authRoutes from "./auth";
import userRoutes from "./users";
import eventRoutes from "./events";
import userNotificationRoutes from "./userNotifications"; // User-centric notification system
import analyticsRoutes from "./analytics";
import searchRoutes from "./search";
import performanceRoutes from "./performance";

const router = Router();

// API versioning
const API_VERSION = "/api/v1";

// Mount routes
router.use(`${API_VERSION}/auth`, authRoutes);
router.use(`${API_VERSION}/users`, userRoutes);
router.use(`${API_VERSION}/events`, eventRoutes);
router.use(`${API_VERSION}/user/notifications`, userNotificationRoutes); // User-centric notification system
router.use(`${API_VERSION}/analytics`, analyticsRoutes);
router.use(`${API_VERSION}/search`, searchRoutes);
router.use(`${API_VERSION}/performance`, performanceRoutes);

// Health check endpoint
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "@Cloud Sign-up System API is running",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// API info endpoint
router.get(`${API_VERSION}`, (req, res) => {
  res.status(200).json({
    success: true,
    message: "@Cloud Sign-up System API",
    version: "1.0.0",
    endpoints: {
      auth: `${API_VERSION}/auth`,
      users: `${API_VERSION}/users`,
      events: `${API_VERSION}/events`,
      notifications: `${API_VERSION}/user/notifications`,
    },
    documentation: {
      auth: {
        register: "POST /auth/register",
        login: "POST /auth/login",
        logout: "POST /auth/logout",
        refreshToken: "POST /auth/refresh-token",
        verifyEmail: "GET /auth/verify-email/:token",
        forgotPassword: "POST /auth/forgot-password",
        resetPassword: "POST /auth/reset-password",
        profile: "GET /auth/profile",
      },
      users: {
        getProfile: "GET /users/profile",
        updateProfile: "PUT /users/profile",
        changePassword: "POST /users/change-password",
        getUserById: "GET /users/:id",
        getAllUsers: "GET /users (admin)",
        updateUserRole: "PUT /users/:id/role (admin)",
        deactivateUser: "PUT /users/:id/deactivate (admin)",
        reactivateUser: "PUT /users/:id/reactivate (admin)",
      },
      events: {
        getAllEvents: "GET /events",
        getEventById: "GET /events/:id",
        createEvent: "POST /events (leader+)",
        updateEvent: "PUT /events/:id",
        deleteEvent: "DELETE /events/:id",
        signUpForEvent: "POST /events/:id/signup",
        cancelSignup: "POST /events/:id/cancel",
        getUserEvents: "GET /events/user/registered",
        getCreatedEvents: "GET /events/user/created",
        getEventParticipants: "GET /events/:id/participants",
      },
      notifications: {
        getUserNotifications: "GET /user/notifications/bell",
        markAsRead: "PATCH /user/notifications/bell/:id/read",
        markAllAsRead: "PATCH /user/notifications/bell/read-all",
        deleteNotification: "DELETE /user/notifications/bell/:id",
        getUnreadCounts: "GET /user/notifications/unread-counts",
        cleanup: "DELETE /user/notifications/cleanup",
      },
      messages: {
        getMessages: "GET /messages",
        sendMessage: "POST /messages",
        deleteMessage: "DELETE /messages/:id",
        getConversations: "GET /messages/conversations",
      },
      systemMessages: {
        getSystemMessages: "GET /system-messages",
        createSystemMessage: "POST /system-messages (admin)",
        markAsRead: "PATCH /system-messages/:id/read",
        deleteSystemMessage: "DELETE /system-messages/:id (admin)",
      },
    },
  });
});

// 404 handler for undefined routes
router.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    suggestion: `Try ${API_VERSION} for available endpoints`,
  });
});

export default router;
