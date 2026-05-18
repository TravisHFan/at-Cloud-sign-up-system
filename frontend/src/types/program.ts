export interface ProgramStudentRole {
  id: string;
  name: string;
  discountEligible: boolean;
  discountAmount: number;
  limit: number;
  count: number;
}

export interface ProgramRoles {
  teacherRoleName: string;
  studentRoles: ProgramStudentRole[];
}

export interface ProgramStudentRoleForm {
  id: string;
  name: string;
  discountEligible: boolean;
  discountAmount: number;
  limit: number;
  count?: number;
}
