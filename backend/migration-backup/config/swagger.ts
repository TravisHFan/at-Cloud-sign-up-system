import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Express } from "express";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "@Cloud Event Sign-up System API",
      version: "1.0.0",
      description:
        "Comprehensive event management and user sign-up system API for @Cloud Ministry",
      contact: {
        name: "Travis Fan @Cloud IT Team",
        email: "support@cloud-ministry.com",
      },
    },
    servers: [
      {
        url: "http://localhost:5001/api/v1",
        description: "Development server",
      },
      {
        url: "https://api.cloud-ministry.com/api/v1",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT Authorization header using the Bearer scheme.",
        },
      },
      schemas: {
        User: {
          type: "object",
          required: ["username", "email", "password"],
          properties: {
            id: {
              type: "string",
              description: "User unique identifier",
            },
            username: {
              type: "string",
              description: "Unique username",
              example: "john_doe",
            },
            email: {
              type: "string",
              format: "email",
              description: "User email address",
              example: "john.doe@example.com",
            },
            firstName: {
              type: "string",
              description: "User first name",
              example: "John",
            },
            lastName: {
              type: "string",
              description: "User last name",
              example: "Doe",
            },
            gender: {
              type: "string",
              enum: ["male", "female"],
              description: "User gender",
            },
            role: {
              type: "string",
              enum: ["Super Admin", "Administrator", "Leader", "Participant"],
              description: "User system role",
            },
            isAtCloudLeader: {
              type: "boolean",
              description: "Whether user is an @Cloud leader",
            },
            roleInAtCloud: {
              type: "string",
              description: "User role within @Cloud ministry",
            },
            isActive: {
              type: "boolean",
              description: "Whether user account is active",
            },
            isVerified: {
              type: "boolean",
              description: "Whether user email is verified",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "User creation timestamp",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "User last update timestamp",
            },
          },
        },
        Event: {
          type: "object",
          required: ["title", "date", "time", "location"],
          properties: {
            id: {
              type: "string",
              description: "Event unique identifier",
            },
            title: {
              type: "string",
              description: "Event title",
              example: "Effective Communication Workshop",
            },
            type: {
              type: "string",
              description: "Event type",
              example: "Workshop",
            },
            date: {
              type: "string",
              format: "date",
              description: "Event date",
              example: "2025-07-25",
            },
            time: {
              type: "string",
              format: "time",
              description: "Event start time",
              example: "14:00",
            },
            endTime: {
              type: "string",
              format: "time",
              description: "Event end time",
              example: "16:00",
            },
            location: {
              type: "string",
              description: "Event location",
              example: "Community Center Hall A",
            },
            description: {
              type: "string",
              description: "Event description",
            },
            organizer: {
              type: "string",
              description: "Event organizer display name",
            },
            roles: {
              type: "array",
              items: {
                $ref: "#/components/schemas/EventRole",
              },
              description: "Available roles for the event",
            },
            status: {
              type: "string",
              enum: ["draft", "published", "cancelled", "completed"],
              description: "Event status",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Event creation timestamp",
            },
          },
        },
        EventRole: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Role unique identifier",
            },
            name: {
              type: "string",
              description: "Role name",
              example: "Participant",
            },
            description: {
              type: "string",
              description: "Role description",
            },
            maxParticipants: {
              type: "number",
              description: "Maximum participants for this role",
              example: 50,
            },
            currentSignups: {
              type: "array",
              items: {
                $ref: "#/components/schemas/EventParticipant",
              },
              description: "Current signups for this role",
            },
          },
        },
        EventParticipant: {
          type: "object",
          properties: {
            userId: {
              type: "string",
              description: "User ID",
            },
            username: {
              type: "string",
              description: "Username",
            },
            firstName: {
              type: "string",
              description: "First name",
            },
            lastName: {
              type: "string",
              description: "Last name",
            },
            avatar: {
              type: "string",
              description: "User avatar URL",
            },
            gender: {
              type: "string",
              enum: ["male", "female"],
              description: "User gender",
            },
          },
        },
        SystemMessage: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Message unique identifier",
            },
            title: {
              type: "string",
              description: "Message title",
            },
            content: {
              type: "string",
              description: "Message content",
            },
            type: {
              type: "string",
              enum: [
                "announcement",
                "maintenance",
                "update",
                "warning",
                "auth_level_change",
              ],
              description: "Message type",
            },
            priority: {
              type: "string",
              enum: ["low", "medium", "high"],
              description: "Message priority",
            },
            isRead: {
              type: "boolean",
              description: "Whether message has been read by user",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Message creation timestamp",
            },
          },
        },
        ApiResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              description: "Whether the request was successful",
            },
            message: {
              type: "string",
              description: "Response message",
            },
            data: {
              type: "object",
              description: "Response data",
            },
          },
        },
        Error: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false,
            },
            message: {
              type: "string",
              description: "Error message",
              example: "Something went wrong",
            },
            error: {
              type: "object",
              description: "Error details (development only)",
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./src/routes/*.ts", "./src/controllers/*.ts"],
};

const specs = swaggerJsdoc(options);

export const setupSwagger = (app: Express): void => {
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(specs, {
      explorer: true,
      customCss: ".swagger-ui .topbar { display: none }",
      customSiteTitle: "@Cloud API Documentation",
    })
  );

  // Serve the raw OpenAPI spec
  app.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(specs);
  });
};

export default specs;
