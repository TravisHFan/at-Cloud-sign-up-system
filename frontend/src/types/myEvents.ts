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
    endDate?: string;
    time: string;
    endTime?: string;
    location: string;
    format: string;
    status: string;
    type: string;
    organizer: string;
    timeZone?: string;
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

// Raw item returned by /events/user/registered API for each registration
// MyEvents page groups these into MyEventItemData by event.id
export interface MyEventRegistrationItem {
  event: {
    id: string;
    title: string;
    date: string;
    endDate?: string;
    time: string;
    endTime?: string;
    location: string;
    format: string;
    status: string;
    type: string;
    organizer: string;
    timeZone?: string;
    createdAt: string;
  };
  registration: MyEventRegistration;
  isPassedEvent: boolean;
  eventStatus: "upcoming" | "passed";
}
