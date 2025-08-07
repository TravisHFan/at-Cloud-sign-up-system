import { Router } from "express";
import authRoutes from "./auth";
import userRoutes from "./users";
import eventRoutes from "./events";
import { emailNotificationRouter } from "./emailNotifications"; // Email notification system
import notificationRoutes from "./notifications"; // Unified notification system
import analyticsRoutes from "./analytics";
import searchRoutes from "./search";
import systemRoutes from "./system"; // System health and monitoring
import monitorRoutes from "./monitor"; // Request monitoring system

const router = Router();

// API versioning
const API_VERSION = "/api/v1";

// Mount versioned routes
router.use(`${API_VERSION}/auth`, authRoutes);
router.use(`${API_VERSION}/users`, userRoutes);
router.use(`${API_VERSION}/events`, eventRoutes);
router.use(`${API_VERSION}/email-notifications`, emailNotificationRouter); // Email notification system
router.use(`${API_VERSION}/notifications`, notificationRoutes); // Unified notification system
router.use(`${API_VERSION}/analytics`, analyticsRoutes);
router.use(`${API_VERSION}/search`, searchRoutes);
router.use(`${API_VERSION}/system`, systemRoutes); // System health and monitoring
router.use(`${API_VERSION}/monitor`, monitorRoutes); // Request monitoring system

// Mount non-versioned routes for backward compatibility (for tests and legacy clients)
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/events", eventRoutes);
router.use("/email-notifications", emailNotificationRouter);
router.use("/notifications", notificationRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/search", searchRoutes);
router.use("/system", systemRoutes);
router.use("/monitor", monitorRoutes);

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
      notifications: `${API_VERSION}/notifications`,
      emailNotifications: `${API_VERSION}/email-notifications`,
      analytics: `${API_VERSION}/analytics`,
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
        getSystemMessages: "GET /notifications/system",
        markAsRead: "PATCH /notifications/system/:messageId/read",
        deleteMessage: "DELETE /notifications/system/:messageId",
        getBellNotifications: "GET /notifications/bell",
        markBellAsRead: "PATCH /notifications/bell/:messageId/read",
        clearBellNotifications: "DELETE /notifications/bell/:messageId",
        getUnreadCounts: "GET /notifications/unread-counts",
        cleanup: "POST /notifications/cleanup",
        sendWelcome: "POST /notifications/welcome",
      },
      emailNotifications: {
        roleChange: "POST /email-notifications/role-change",
        eventCreated: "POST /email-notifications/event-created",
        coOrganizerAssigned: "POST /email-notifications/co-organizer-assigned",
        newLeaderSignup: "POST /email-notifications/new-leader-signup",
        eventReminder: "POST /email-notifications/event-reminder",
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
