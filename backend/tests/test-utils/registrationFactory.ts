import mongoose from "mongoose";
import Event from "../../src/models/Event";
import Registration from "../../src/models/Registration";
import User from "../../src/models/User";

interface CreateRegistrationParams {
  roleName?: string;
  roleDescription?: string;
}

export async function createUser(overrides: Partial<any> = {}) {
  const base = {
    username: `user_${new mongoose.Types.ObjectId().toString().slice(-6)}`,
    email: `${Date.now()}_${Math.random().toString(36).slice(2)}@test.dev`,
    password: "Password1",
    role: "Participant",
    isActive: true,
    isVerified: true,
    ...overrides,
  };
  return await User.create(base);
}

export async function createEvent(overrides: Partial<any> = {}) {
  const creator = overrides.createdBy || new mongoose.Types.ObjectId();
  const base = {
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
    roles: [
      {
        id: "role1",
        name: overrides.roleName || "Speaker",
        description: overrides.roleDescription || "Speak things",
        maxParticipants: 5,
      },
    ],
  };
  return await Event.create(base);
}

export async function createRegistration(
  params: CreateRegistrationParams = {}
) {
  const user = await createUser();
  const event = await createEvent({
    roleName: params.roleName,
    roleDescription: params.roleDescription,
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
  });

  return { user, event, registration: reg, role };
}
