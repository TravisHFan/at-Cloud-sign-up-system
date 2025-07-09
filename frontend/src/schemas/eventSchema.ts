import * as yup from "yup";

export const eventSchema = yup
  .object({
    title: yup.string().required("Event title is required"),
    description: yup.string().required("Event description is required"),
    date: yup.string().required("Event date is required"),
    time: yup.string().required("Event time is required"),
    location: yup.string().required("Event location is required"),
    totalSlots: yup
      .number()
      .required("Total slots is required")
      .min(1, "Must have at least 1 slot"),
    category: yup.string().required("Event category is required"),
    isHybrid: yup.boolean().default(false),
    zoomLink: yup.string().when("isHybrid", {
      is: true,
      then: (schema) =>
        schema.required("Zoom link is required for online events"),
      otherwise: (schema) => schema.optional(),
    }),
    requirements: yup.string().optional(),
    materials: yup.string().optional(),
  })
  .required();

export type EventFormData = yup.InferType<typeof eventSchema>;
