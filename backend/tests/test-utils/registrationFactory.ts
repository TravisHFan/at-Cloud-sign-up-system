import mongoose from "mongoose";
import Event from "../../src/models/Event";
import Registration from "../../src/models/Registration";
import User from "../../src/models/User";

type TestGender = "male" | "female";

interface CreateRegistrationParams {
  roleName?: string;
  roleDescription?: string;
  userOverrides?: Partial<any>;
  eventOverrides?: Partial<any>;
  registrationOverrides?: Partial<any>;
}

const uniqueSuffix = () => new mongoose.Types.ObjectId().toString().slice(-6);

export function buildUserDocument(overrides: Partial<any> = {}) {
  return {
    username: `user_${new mongoose.Types.ObjectId().toString().slice(-6)}`,
    email: `${Date.now()}_${Math.random().toString(36).slice(2)}@test.dev`,
    password: "Password1",
    firstName: "Test",
    lastName: "User",
    gender: "male" as TestGender,
    role: "Participant",
    isAtCloudLeader: false,
    isActive: true,
    isVerified: true,
    ...overrides,
  };
}

export async function createUser(overrides: Partial<any> = {}) {
  return await User.create(buildUserDocument(overrides));
}

export function buildEventDocument(overrides: Partial<any> = {}) {
  const creator = overrides.createdBy || new mongoose.Types.ObjectId();
  return {
    title: overrides.title || "Test Event",
    date: overrides.date || "2030-01-01",
    time: overrides.time || "10:00",
    endTime: overrides.endTime || "12:00",
    location: overrides.location || "Test Location",
    organizer: overrides.organizer || "Test Organizer",
    type: overrides.type || "Webinar",
    format: overrides.format || "Online",
    status: overrides.status || "upcoming",
    createdBy: creator,
    roles: overrides.roles || [
      {
        id: `role_${uniqueSuffix()}`,
        name: overrides.roleName || "Speaker",
        description: overrides.roleDescription || "Speak things",
        maxParticipants: 5,
      },
    ],
  };
}

export async function createEvent(overrides: Partial<any> = {}) {
  return await Event.create(buildEventDocument(overrides));
}

export async function createRegistration(
  params: CreateRegistrationParams = {}
) {
  const user = await createUser(params.userOverrides);
  const event = await createEvent({
    ...params.eventOverrides,
    roleName: params.roleName ?? params.eventOverrides?.roleName,
    roleDescription:
      params.roleDescription ?? params.eventOverrides?.roleDescription,
  });

  const role = event.roles[0];

  const reg = await Registration.create({
    eventId: event._id,
    userId: user._id,
    roleId: role.id,
    registrationDate: new Date(),
    registeredBy: user._id, // self-assigned in test context
    userSnapshot: {
      username: user.username,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email,
      systemAuthorizationLevel: user.role,
      roleInAtCloud: user.roleInAtCloud,
      avatar: user.avatar,
      gender: user.gender,
    },
    eventSnapshot: {
      title: event.title,
      date: event.date,
      time: event.time,
      // endTime is not required in snapshot consumers, but available on event
      location: event.location,
      type: event.type,
      roleName: role.name,
      roleDescription: role.description,
    },
    status: "active",
    ...params.registrationOverrides,
  });

  return { user, event, registration: reg, role };
}
