import * as yup from "yup";

export const eventSchema = yup
  .object({
    // Required basic fields
    title: yup.string().required("Event title is required"),
    type: yup.string().required("Event type is required"),
    date: yup.string().required("Event date is required"),
    time: yup.string().required("Event start time is required"),
    endTime: yup.string().required("Event end time is required"),
    organizer: yup.string().required("Organizer is required"),
    purpose: yup.string().required("Purpose is required"),
    agenda: yup.string().required("Event agenda and schedule is required"),
    format: yup.string().required("Format is required"),

    // Optional basic fields
    hostedBy: yup.string().optional(),
    disclaimer: yup.string().optional(),
    organizerDetails: yup.array().optional(),

    // Conditional fields
    location: yup.string().when("format", {
      is: (format: string) =>
        format === "Hybrid Participation" || format === "In-person",
      then: (schema) =>
        schema.required("Location is required for in-person/hybrid events"),
      otherwise: (schema) => schema.optional(),
    }),
    zoomLink: yup.string().optional(), // Zoom link is now optional for all formats

    // Optional technical fields
    meetingId: yup.string().optional(),
    passcode: yup.string().optional(),
    requirements: yup.string().optional(),
    materials: yup.string().optional(),
    timeZone: yup.string().optional(),

    // System fields that can be auto-generated
    id: yup.string().optional(),
    description: yup.string().optional(), // Can be auto-generated
    isHybrid: yup.boolean().optional(),
    signedUp: yup.number().optional(),
    totalSlots: yup.number().optional(),
    createdBy: yup.string().optional(),
    createdAt: yup.string().optional(),

    // Roles - simplified for now
    roles: yup.array().optional(),
  })
  .required();

export type EventFormData = yup.InferType<typeof eventSchema>;
