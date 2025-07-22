// Shared types for My Events functionality

export interface MyEventRegistration {
  id: string;
  roleId: string;
  roleName: string;
  roleDescription?: string;
  registrationDate: string;
  status: "active" | "waitlisted" | "attended" | "no_show";
  notes?: string;
  specialRequirements?: string;
}

export interface MyEventItemData {
  event: {
    id: string;
    title: string;
    date: string;
    time: string;
    endTime?: string;
    location: string;
    format: string;
    status: string;
    type: string;
    organizer: string;
    createdAt: string;
  };
  registrations: MyEventRegistration[];
  isPassedEvent: boolean;
  eventStatus: "upcoming" | "passed";
}

export interface MyEventStats {
  total: number;
  upcoming: number;
  passed: number;
  cancelled?: number;
}
