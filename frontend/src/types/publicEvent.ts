// Shared types for public event fetch & registration flows

export interface PublicEventRole {
  roleId: string;
  name: string;
  description: string;
  maxParticipants: number;
  capacityRemaining: number;
}

// For the listing page - simplified data from backend
export interface PublicEventListItem {
  title: string;
  slug: string;
  start: string; // ISO
  end: string; // ISO
  location: string;
  flyerUrl?: string;
  rolesOpen: number;
  capacityRemaining: number;
}

// For individual event page - full data
export interface PublicEventData {
  id: string; // backend now includes eventId for share modal short link generation
  title: string;
  purpose?: string;
  agenda?: string;
  start: string; // ISO
  end: string; // ISO
  location: string;
  flyerUrl?: string;
  roles: PublicEventRole[];
  slug: string;
}

export interface PublicRegistrationResponse {
  status: string;
  registrationId: string;
  type?: string; // user | guest
  duplicate?: boolean;
  message?: string;
}

export interface PublicRegistrationPayload {
  roleId: string;
  attendee: { name: string; email: string; phone?: string };
  consent: { termsAccepted: boolean };
}
