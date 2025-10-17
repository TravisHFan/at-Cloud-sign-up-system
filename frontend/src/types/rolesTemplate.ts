// Role Template Types

export interface TemplateRole {
  name: string;
  description?: string; // Made optional
  maxParticipants: number;
  openToPublic?: boolean;
  agenda?: string;
  startTime?: string;
  endTime?: string;
}

export interface RolesTemplate {
  _id: string;
  name: string;
  eventType: string;
  roles: TemplateRole[];
  createdBy: {
    _id: string;
    firstName?: string;
    lastName?: string;
    username: string;
    avatar?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplatePayload {
  name: string;
  eventType: string;
  roles: TemplateRole[];
}

export interface UpdateTemplatePayload {
  name?: string;
  roles?: TemplateRole[];
}

export interface GroupedTemplates {
  [eventType: string]: RolesTemplate[];
}
