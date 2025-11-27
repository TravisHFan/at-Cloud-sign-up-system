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
  type?: string;
  slug: string;
  start: string; // ISO
  end: string; // ISO
  // Raw components for proper timezone handling (same as detail page)
  date: string;
  endDate?: string;
  time: string;
  endTime: string;
  timeZone?: string;
  location: string;
  flyerUrl?: string;
  secondaryFlyerUrl?: string;
  rolesOpen: number;
  capacityRemaining: number;
}

// For individual event page - full data
export interface PublicEventData {
  id: string; // backend now includes eventId for share modal short link generation
  title: string;
  tagline?: string; // short marketing blurb displayed under title in serif font
  purpose?: string;
  agenda?: string;
  disclaimer?: string;
  start: string; // ISO
  end: string; // ISO
  // Raw components for local formatting (added for parity with internal EventDetail formatter)
  date: string;
  endDate?: string;
  time: string;
  endTime: string;
  timeZone?: string;
  location: string;
  flyerUrl?: string;
  secondaryFlyerUrl?: string;
  hostedBy?: string; // optional hosting organization/name
  format?: string; // event format (Online | In-person | Hybrid Participation)
  roles: PublicEventRole[];
  slug: string;
  isAuthenticated?: boolean; // added optional auth flag
  pricing?: {
    isFree: boolean;
    price?: number; // in cents
  };
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
