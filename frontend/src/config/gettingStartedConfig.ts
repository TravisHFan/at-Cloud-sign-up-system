export interface GettingStartedStep {
  stepNumber: number;
  title: string;
  description: string;
  color: "blue" | "green" | "purple" | "orange";
}

export const gettingStartedSteps: GettingStartedStep[] = [
  {
    stepNumber: 1,
    title: "Complete Your Profile",
    description:
      "Add your personal information and ministry details to help others connect with you.",
    color: "blue",
  },
  {
    stepNumber: 2,
    title: "Explore Community Events",
    description:
      "Discover and participate in events created by other ministry leaders.",

    color: "green",
  },
  {
    stepNumber: 3,
    title: "Create Your First Event",
    description:
      "Share your ministry events with the @Cloud community and start building connections.",
    color: "purple",
  },
  {
    stepNumber: 4,
    title: "Connect & Collaborate",
    description:
      "Build relationships with other ministry leaders and grow your impact together.",
    color: "orange",
  },
];
