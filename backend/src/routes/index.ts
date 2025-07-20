import { Router } from "express";
import authRoutes from "./auth";
import userRoutes from "./users";
import eventRoutes from "./events";
import userNotificationRoutes from "./userNotifications"; // User-centric notification system
import systemMessageRoutes from "./systemMessages"; // System messages (Hybrid Architecture)
import analyticsRoutes from "./analytics";
import searchRoutes from "./search";
import debugRoutes from "./debug"; // Debug routes for development

const router = Router();

// API versioning
const API_VERSION = "/api/v1";

// Mount routes
router.use(`${API_VERSION}/auth`, authRoutes);
router.use(`${API_VERSION}/users`, userRoutes);
router.use(`${API_VERSION}/events`, eventRoutes);
router.use(`${API_VERSION}/user/notifications`, userNotificationRoutes); // User-centric notification system
router.use(`${API_VERSION}/system-messages`, systemMessageRoutes); // System messages (Hybrid Architecture)
router.use(`${API_VERSION}/analytics`, analyticsRoutes);
router.use(`${API_VERSION}/search`, searchRoutes);
router.use(`${API_VERSION}/debug`, debugRoutes); // Debug routes for development

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
        getUnreadCounts: "GET /user/notifications/unread-counts",
        cleanup: "DELETE /user/notifications/cleanup",
      },
      systemMessages: {
        getSystemMessages: "GET /system-messages",
        createSystemMessage: "POST /system-messages (non-Participant)",
        markAsRead: "PATCH /system-messages/:messageId/read",
        deleteSystemMessage: "DELETE /system-messages/:messageId",
        getBellNotifications: "GET /system-messages/bell-notifications",
        markBellAsRead:
          "PATCH /system-messages/bell-notifications/:messageId/read",
        removeBellNotification:
          "DELETE /system-messages/bell-notifications/:messageId",
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
