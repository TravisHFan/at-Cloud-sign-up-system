/**
 * useProgramCreation Hook
 *
 * Custom hook that encapsulates program creation logic including:
 * - Form submission handling
 * - Month name to code conversion
 * - Mentor data transformation
 * - Payload preparation with pricing conversions
 * - API calls and error handling
 * - Navigation after success
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { programService } from "../services/api";

interface Mentor {
  id: string;
  firstName: string;
  lastName: string;
  systemAuthorizationLevel: string;
  roleInAtCloud?: string;
  gender: "male" | "female";
  avatar: string | null;
  email: string;
  phone?: string;
}

type MentorPayload = {
  userId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  gender?: "male" | "female";
  avatar?: string | null;
  roleInAtCloud?: string;
};

type ProgramPayload = {
  programType: string;
  title: string;
  hostedBy?: string;
  period?: {
    startYear?: string;
    startMonth?: string;
    endYear?: string;
    endMonth?: string;
  };
  introduction?: string;
  flyerUrl?: string;
  earlyBirdDeadline?: string;
  isFree?: boolean;
  mentors?: MentorPayload[];
  fullPriceTicket: number;
  classRepDiscount?: number;
  classRepLimit?: number;
  earlyBirdDiscount?: number;
};

interface ProgramFormData {
  programType: string;
  title: string;
  startYear: string;
  startMonth: string;
  endYear: string;
  endMonth: string;
  hostedBy: string;
  introduction: string;
  flyerUrl?: string;
  flyer?: FileList;
  earlyBirdDeadline?: string;
  isFree?: string;
  fullPriceTicket: number | undefined;
  classRepDiscount?: number | undefined;
  classRepLimit?: number | undefined;
  earlyBirdDiscount?: number | undefined;
}

// Map month names to 2-digit codes
const MONTH_NAME_TO_CODE: Record<string, string> = {
  January: "01",
  February: "02",
  March: "03",
  April: "04",
  May: "05",
  June: "06",
  July: "07",
  August: "08",
  September: "09",
  October: "10",
  November: "11",
  December: "12",
};

/**
 * Transform mentor data to API format
 */
const transformMentor = (mentor: Mentor): MentorPayload => ({
  userId: mentor.id,
  firstName: mentor.firstName,
  lastName: mentor.lastName,
  email: mentor.email,
  gender: mentor.gender,
  avatar: mentor.avatar,
  roleInAtCloud: mentor.roleInAtCloud,
});

/**
 * Custom hook for program creation
 */
export function useProgramCreation() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Submit program creation form
   */
  const createProgram = async (
    data: ProgramFormData,
    mentors: Mentor[]
  ): Promise<void> => {
    try {
      setIsSubmitting(true);

      // Prepare program payload
      const payload: ProgramPayload = {
        title: data.title,
        programType: data.programType,
        hostedBy: data.hostedBy,
        period: {
          startYear: data.startYear,
          startMonth:
            MONTH_NAME_TO_CODE[data.startMonth] || data.startMonth?.slice(0, 2),
          endYear: data.endYear,
          endMonth:
            MONTH_NAME_TO_CODE[data.endMonth] || data.endMonth?.slice(0, 2),
        },
        introduction: data.introduction,
        flyerUrl: data.flyerUrl,
        earlyBirdDeadline: data.earlyBirdDeadline
          ? data.earlyBirdDeadline
          : undefined,
        isFree: data.isFree === "true",
        // Pricing from form - convert dollars to cents
        fullPriceTicket: Number.isFinite(data.fullPriceTicket as number)
          ? Math.round((data.fullPriceTicket as number) * 100)
          : 0,
        classRepDiscount: Number.isFinite(data.classRepDiscount as number)
          ? Math.round((data.classRepDiscount as number) * 100)
          : 0,
        classRepLimit: Number.isFinite(data.classRepLimit as number)
          ? (data.classRepLimit as number)
          : 0,
        earlyBirdDiscount: Number.isFinite(data.earlyBirdDiscount as number)
          ? Math.round((data.earlyBirdDiscount as number) * 100)
          : 0,
      };

      // Add unified mentors for all program types
      payload.mentors = mentors.map(transformMentor);

      // Create the program via API
      await programService.createProgram(payload);

      navigate("/dashboard/programs");
    } catch (error) {
      console.error("Error creating program:", error);
      // TODO: Show user-friendly error message
      alert("Failed to create program. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Cancel program creation
   */
  const cancelCreation = () => {
    navigate("/dashboard/programs");
  };

  return {
    isSubmitting,
    createProgram,
    cancelCreation,
  };
}
