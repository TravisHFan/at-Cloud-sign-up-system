/**
 * Shared types for promo code controllers
 */

// Type for populated user reference
export interface PopulatedUser {
  _id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username: string;
}

// Type for populated program reference
export interface PopulatedProgram {
  _id: string;
  title: string;
}
