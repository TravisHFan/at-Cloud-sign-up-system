import type { ProgramType } from "../constants/programTypes";

export interface AnnualMembershipProgram {
  id?: string;
  _id?: string;
  title: string;
  programType?: ProgramType | string;
  isFree?: boolean;
  fullPriceTicket?: number;
  period?: {
    startYear?: string;
    startMonth?: string;
    endYear?: string;
    endMonth?: string;
  };
}

export interface AnnualMembership {
  id: string;
  _id?: string;
  title: string;
  programs: AnnualMembershipProgram[];
  price: number;
  isActive: boolean;
  purchased?: boolean;
  adminAccess?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AnnualMembershipPayload {
  title: string;
  programIds: string[];
  price: number;
  isActive?: boolean;
}
