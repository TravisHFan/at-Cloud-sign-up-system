import * as yup from "yup";

export const eventSchema = yup
  .object({
    id: yup.number().required("Event ID is required"),
    title: yup.string().required("Event title is required"),
    description: yup.string().required("Event description is required"),
    date: yup.string().required("Event date is required"),
    time: yup.string().required("Event time is required"),
    location: yup.string().when("format", {
      is: (format: string) =>
        format === "Hybrid Participation" || format === "In-person",
      then: (schema) =>
        schema.required("Location is required for in-person/hybrid events"),
      otherwise: (schema) => schema.optional(),
    }),
    type: yup.string().required("Event type is required"),
    organizer: yup.string().required("Organizer is required"),
    purpose: yup.string().required("Purpose is required"),
    format: yup.string().required("Format is required"),
    disclaimer: yup.string().required("Disclaimer is required"),
    roles: yup
      .array()
      .of(
        yup.object({
          id: yup.string().required("Role ID is required"),
          name: yup.string().required("Role name is required"),
          description: yup.string().required("Role description is required"),
          maxParticipants: yup
            .number()
            .required("Max participants is required"),
          currentSignups: yup.array().of(
            yup.object({
              userId: yup.number().required("User ID is required"),
              username: yup.string().required("Username is required"),
            })
          ),
        })
      )
      .required("Roles are required"),
    signedUp: yup.number().required("Signed up count is required"),
    totalSlots: yup
      .number()
      .required("Total slots is required")
      .min(1, "Must have at least 1 slot"),
    category: yup.string().required("Event category is required"),
    isHybrid: yup.boolean().default(false),
    zoomLink: yup.string().when("format", {
      is: (format: string) =>
        format === "Hybrid Participation" || format === "Online",
      then: (schema) =>
        schema.required("Zoom link is required for online/hybrid events"),
      otherwise: (schema) => schema.optional(),
    }),
    meetingId: yup.string().optional(),
    passcode: yup.string().optional(),
    requirements: yup.string().optional(),
    materials: yup.string().optional(),
    createdBy: yup.number().required("Created by is required"),
    createdAt: yup.string().required("Created at is required"),
  })
  .required();

export type EventFormData = yup.InferType<typeof eventSchema>;
