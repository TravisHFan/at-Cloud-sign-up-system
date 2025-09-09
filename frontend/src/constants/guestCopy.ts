// Centralized copy for guest flows. Keep wording identical to current UI to avoid behavior changes.

export type Perspective = "self" | "inviter";

export const guestCopy = {
  sections: {
    personal: (p: Perspective) =>
      p === "inviter" ? "Personal Information" : "Your Information",
    contact: "Contact Information",
    additional: "Additional Information",
  },
  labels: {
    fullName: (p: Perspective) =>
      p === "inviter" ? "Guest's Full Name *" : "Your Full Name *",
    gender: (p: Perspective) =>
      p === "inviter" ? "Guest's Gender *" : "Your Gender *",
    email: (p: Perspective) =>
      p === "inviter" ? "Guest's Email Address *" : "Your Email Address *",
    phone: (p: Perspective) =>
      p === "inviter" ? "Guest's Phone Number" : "Your Phone Number",
    notes: "Additional Notes ",
    notesOptional: "(Optional)",
  },
  placeholders: {
    fullName: (p: Perspective) =>
      p === "inviter" ? "Enter the guest's full name" : "Enter your full name",
    gender: (p: Perspective) =>
      p === "inviter" ? "Select the guest's gender" : "Select your gender",
    email: (p: Perspective) =>
      p === "inviter"
        ? "Enter the guest's email address"
        : "Enter your email address",
    phone: (p: Perspective) =>
      p === "inviter"
        ? "Enter the guest's phone number"
        : "Enter your phone number",
    notes: (p: Perspective) =>
      p === "inviter"
        ? "Any special requirements, dietary restrictions, or additional information for the guest..."
        : "Any special requirements, dietary restrictions, or additional information you'd like us to know...",
  },
  errors: {
    genderRequired: (p: Perspective) =>
      p === "inviter"
        ? "Please select the guest's gender."
        : "Please select your gender.",
    phoneRequired: (p: Perspective) =>
      p === "inviter"
        ? "Please provide the guest's phone number."
        : "Please provide your phone number.",
  },
  submit: (submitting: boolean, p: Perspective) =>
    submitting
      ? "Submitting Registration..."
      : p === "inviter"
      ? "Register Guest"
      : "Register",
  privacy: (p: Perspective) =>
    p === "inviter"
      ? "The guest's information will only be used for this event and related communications. We won't share their details with third parties or add them to marketing lists without their consent."
      : "Your information will only be used for this event and related communications. We won't share your details with third parties or add you to marketing lists without your consent.",
};
