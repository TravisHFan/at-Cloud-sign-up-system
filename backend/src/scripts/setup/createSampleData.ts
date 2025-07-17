import mongoose from "mongoose";
import dotenv from "dotenv";
import { User, Event, Registration } from "../../models";
import { ROLES } from "../../utils/roleUtils";
import { v4 as uuidv4 } from "uuid";

// Load environment variables
dotenv.config();

// Sample Users Data (matching frontend mock data structure)
const sampleUsers = [
  {
    username: "john_doe",
    email: "john@example.com",
    password: "Password123!",
    firstName: "John",
    lastName: "Doe",
    gender: "male",
    isAtCloudLeader: true,
    roleInAtCloud: "System Administrator",
    occupation: "Software Engineer",
    company: "Tech Company Inc.",
    weeklyChurch: "Grace Community Church",
    role: ROLES.SUPER_ADMIN,
    isActive: true,
    isVerified: true,
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
  },
  {
    username: "jane_smith",
    email: "jane@example.com",
    password: "Password123!",
    firstName: "Jane",
    lastName: "Smith",
    gender: "female",
    isAtCloudLeader: true,
    roleInAtCloud: "Event Director",
    occupation: "Project Manager",
    company: "Ministry Solutions",
    weeklyChurch: "Grace Community Church",
    role: ROLES.LEADER,
    isActive: true,
    isVerified: true,
    emailNotifications: true,
    smsNotifications: true,
    pushNotifications: true,
  },
  {
    username: "mike_wilson",
    email: "mike@example.com",
    password: "Password123!",
    firstName: "Mike",
    lastName: "Wilson",
    gender: "male",
    isAtCloudLeader: true,
    roleInAtCloud: "Technical Director",
    occupation: "IT Specialist",
    company: "@Cloud Ministry",
    weeklyChurch: "Grace Community Church",
    role: ROLES.ADMINISTRATOR,
    isActive: true,
    isVerified: true,
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
  },
  {
    username: "sarah_brown",
    email: "sarah@example.com",
    password: "Password123!",
    firstName: "Sarah",
    lastName: "Brown",
    gender: "female",
    isAtCloudLeader: true,
    roleInAtCloud: "Worship Leader",
    occupation: "Music Teacher",
    company: "Local School District",
    weeklyChurch: "Grace Community Church",
    role: ROLES.LEADER,
    isActive: true,
    isVerified: true,
    emailNotifications: true,
    smsNotifications: true,
    pushNotifications: false,
  },
  {
    username: "david_garcia",
    email: "david@example.com",
    password: "Password123!",
    firstName: "David",
    lastName: "Garcia",
    gender: "male",
    isAtCloudLeader: false,
    occupation: "Marketing Specialist",
    company: "Creative Agency",
    weeklyChurch: "Grace Community Church",
    role: ROLES.PARTICIPANT,
    isActive: true,
    isVerified: true,
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
  },
  {
    username: "lisa_anderson",
    email: "lisa@example.com",
    password: "Password123!",
    firstName: "Lisa",
    lastName: "Anderson",
    gender: "female",
    isAtCloudLeader: false,
    occupation: "Graphic Designer",
    company: "Freelance",
    weeklyChurch: "Grace Community Church",
    role: ROLES.PARTICIPANT,
    isActive: true,
    isVerified: true,
    emailNotifications: true,
    smsNotifications: true,
    pushNotifications: true,
  },
  {
    username: "robert_lee",
    email: "robert@example.com",
    password: "Password123!",
    firstName: "Robert",
    lastName: "Lee",
    gender: "male",
    isAtCloudLeader: true,
    roleInAtCloud: "Youth Pastor",
    occupation: "Pastor",
    company: "@Cloud Ministry",
    weeklyChurch: "Grace Community Church",
    role: ROLES.LEADER,
    isActive: true,
    isVerified: true,
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
  },
  {
    username: "emily_davis",
    email: "emily@example.com",
    password: "Password123!",
    firstName: "Emily",
    lastName: "Davis",
    gender: "female",
    isAtCloudLeader: false,
    occupation: "Nurse",
    company: "City Hospital",
    weeklyChurch: "Grace Community Church",
    role: ROLES.PARTICIPANT,
    isActive: true,
    isVerified: true,
    emailNotifications: false,
    smsNotifications: false,
    pushNotifications: false,
  },
];

// Sample Events Data (matching frontend mock events)
const sampleEvents = [
  {
    title: "Effective Communication Workshop Series",
    type: "Effective Communication Workshop Series",
    date: "2025-07-19",
    time: "14:00",
    endTime: "17:30",
    location: "Main Sanctuary",
    organizer: "John Doe",
    hostedBy: "@Cloud Marketplace Ministry",
    purpose:
      "Develop communication skills and enhance ministry effectiveness through interactive workshops and practical exercises.",
    agenda:
      "2:00 PM - Welcome and Registration\\n2:30 PM - Opening Session: Introduction to Effective Communication\\n3:30 PM - Workshop Break\\n4:00 PM - Interactive Exercise: Active Listening\\n5:00 PM - Group Discussion and Q&A\\n5:30 PM - Closing Remarks",
    format: "Hybrid Participation",
    disclaimer:
      "Bring your own materials. Please arrive 15 minutes early for setup.",
    description:
      "An interactive workshop series designed to enhance communication skills for ministry effectiveness.",
    category: "Workshop",
    isHybrid: true,
    roles: [
      {
        id: uuidv4(),
        name: "Spiritual Covering",
        description:
          "Provides spiritual oversight and prayer support throughout the workshop",
        maxParticipants: 2,
        currentSignups: [],
      },
      {
        id: uuidv4(),
        name: "Technical Support",
        description:
          "Manages audio/visual equipment and handles technical aspects",
        maxParticipants: 3,
        currentSignups: [],
      },
      {
        id: uuidv4(),
        name: "Registration Support",
        description:
          "Assists with participant check-in and material distribution",
        maxParticipants: 4,
        currentSignups: [],
      },
      {
        id: uuidv4(),
        name: "Workshop Facilitator",
        description: "Leads workshop activities and group discussions",
        maxParticipants: 2,
        currentSignups: [],
      },
    ],
    status: "upcoming",
  },
  {
    title: "Youth Ministry Leadership Training",
    type: "Leadership Training",
    date: "2025-07-25",
    time: "10:00",
    endTime: "16:00",
    location: "Youth Center",
    organizer: "Robert Lee",
    hostedBy: "@Cloud Youth Ministry",
    purpose:
      "Equip youth leaders with essential skills for effective ministry and mentorship.",
    agenda:
      "10:00 AM - Registration and Welcome\\n10:30 AM - Leadership Fundamentals\\n12:00 PM - Lunch Break\\n1:00 PM - Practical Ministry Skills\\n3:00 PM - Mentorship Workshop\\n4:00 PM - Closing and Next Steps",
    format: "In-Person Only",
    disclaimer:
      "Lunch will be provided. Please bring a notebook for exercises.",
    description:
      "Comprehensive training for current and aspiring youth ministry leaders.",
    category: "Training",
    isHybrid: false,
    roles: [
      {
        id: uuidv4(),
        name: "Lead Trainer",
        description: "Primary instructor for the training sessions",
        maxParticipants: 1,
        currentSignups: [],
      },
      {
        id: uuidv4(),
        name: "Assistant Facilitator",
        description: "Supports training activities and group work",
        maxParticipants: 2,
        currentSignups: [],
      },
      {
        id: uuidv4(),
        name: "Setup Team",
        description: "Handles room setup and material preparation",
        maxParticipants: 3,
        currentSignups: [],
      },
    ],
    status: "upcoming",
  },
  {
    title: "Community Outreach Planning",
    type: "Planning Meeting",
    date: "2025-07-12",
    time: "09:00",
    endTime: "11:30",
    location: "Conference Room A",
    organizer: "Sarah Brown",
    hostedBy: "@Cloud Community Outreach",
    purpose:
      "Plan and coordinate upcoming community outreach initiatives and volunteer opportunities.",
    agenda:
      "9:00 AM - Opening Prayer and Welcome\\n9:15 AM - Review Previous Outreach Results\\n10:00 AM - New Initiative Planning\\n10:45 AM - Volunteer Coordination\\n11:15 AM - Action Items and Closing",
    format: "Hybrid Participation",
    disclaimer: "Coffee and light refreshments will be provided.",
    description: "Strategic planning session for community outreach programs.",
    category: "Planning",
    isHybrid: true,
    roles: [
      {
        id: uuidv4(),
        name: "Meeting Facilitator",
        description: "Leads the meeting and keeps discussions on track",
        maxParticipants: 1,
        currentSignups: [],
      },
      {
        id: uuidv4(),
        name: "Note Taker",
        description: "Records meeting minutes and action items",
        maxParticipants: 1,
        currentSignups: [],
      },
      {
        id: uuidv4(),
        name: "Resource Coordinator",
        description: "Manages materials and coordinates logistics",
        maxParticipants: 2,
        currentSignups: [],
      },
    ],
    status: "upcoming",
  },
  {
    title: "Worship Technology Workshop",
    type: "Technology Workshop",
    date: "2025-06-15",
    time: "13:00",
    endTime: "17:00",
    location: "Main Sanctuary",
    organizer: "Mike Wilson",
    hostedBy: "@Cloud Technical Ministry",
    purpose:
      "Train volunteers on worship technology systems including sound, lighting, and streaming equipment.",
    agenda:
      "1:00 PM - Equipment Overview\\n2:00 PM - Sound System Training\\n3:00 PM - Break\\n3:15 PM - Lighting Systems\\n4:00 PM - Streaming Setup\\n4:45 PM - Hands-on Practice",
    format: "In-Person Only",
    disclaimer:
      "Technical equipment will be provided. No prior experience required.",
    description: "Hands-on training for worship technology volunteers.",
    category: "Technology",
    isHybrid: false,
    roles: [
      {
        id: uuidv4(),
        name: "Technical Instructor",
        description: "Leads technical training sessions",
        maxParticipants: 1,
        currentSignups: [],
      },
      {
        id: uuidv4(),
        name: "Equipment Assistant",
        description: "Helps with equipment setup and troubleshooting",
        maxParticipants: 2,
        currentSignups: [],
      },
    ],
    status: "completed",
  },
];

const createSampleData = async () => {
  try {
    // Connect to MongoDB
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/atcloud-signup";
    await mongoose.connect(mongoURI);
    console.log("✅ Connected to MongoDB");

    // Clear existing sample data (keep admin users)
    console.log("🧹 Cleaning up existing sample data...");
    await User.deleteMany({
      email: {
        $nin: ["admin@atcloud.org", "leader@atcloud.org", "user@atcloud.org"],
      },
    });
    await Event.deleteMany({});
    await Registration.deleteMany({});

    // Create sample users
    console.log("👥 Creating sample users...");
    const createdUsers: any[] = [];

    for (const userData of sampleUsers) {
      try {
        const existingUser = await User.findOne({ email: userData.email });
        if (!existingUser) {
          const user = new User(userData);
          await user.save();
          createdUsers.push(user);
          console.log(`   ✅ Created user: ${user.username} (${user.role})`);
        } else {
          createdUsers.push(existingUser);
          console.log(`   ⚠️  User already exists: ${existingUser.username}`);
        }
      } catch (error: any) {
        console.error(
          `   ❌ Failed to create user ${userData.username}:`,
          error.message
        );
      }
    }

    // Create sample events
    console.log("📅 Creating sample events...");
    const createdEvents: any[] = [];

    for (const eventData of sampleEvents) {
      try {
        // Find the organizer user
        const organizer = createdUsers.find(
          (user) => `${user.firstName} ${user.lastName}` === eventData.organizer
        );

        if (organizer) {
          // Calculate total slots
          const totalSlots = eventData.roles.reduce(
            (sum, role) => sum + role.maxParticipants,
            0
          );

          const event = new Event({
            ...eventData,
            createdBy: organizer._id,
            totalSlots,
            signedUp: 0,
          });

          await event.save();
          createdEvents.push(event);
          console.log(`   ✅ Created event: ${event.title}`);
        } else {
          console.log(
            `   ⚠️  Organizer not found for event: ${eventData.title}`
          );
        }
      } catch (error: any) {
        console.error(
          `   ❌ Failed to create event ${eventData.title}:`,
          error.message
        );
      }
    }

    // Create some sample registrations
    console.log("📝 Creating sample registrations...");

    if (createdEvents.length > 0 && createdUsers.length > 0) {
      const firstEvent = createdEvents[0]; // Communication Workshop
      const participants = createdUsers.slice(1, 4); // Take a few users as participants

      for (
        let i = 0;
        i < participants.length && i < firstEvent.roles.length;
        i++
      ) {
        const participant = participants[i];
        const role = firstEvent.roles[i];

        try {
          // Add user to event role
          const userSignupData = {
            username: participant.username,
            firstName: participant.firstName,
            lastName: participant.lastName,
            systemAuthorizationLevel: participant.role,
            roleInAtCloud: participant.roleInAtCloud,
            avatar: participant.avatar,
            gender: participant.gender,
            notes: `Excited to participate in ${role.name}!`,
          };

          await firstEvent.addUserToRole(
            participant._id,
            role.id,
            userSignupData
          );

          // Create registration record
          const registration = new Registration({
            userId: participant._id,
            eventId: firstEvent._id,
            roleId: role.id,
            userSnapshot: {
              username: participant.username,
              firstName: participant.firstName,
              lastName: participant.lastName,
              email: participant.email,
              systemAuthorizationLevel: participant.role,
              roleInAtCloud: participant.roleInAtCloud,
              avatar: participant.avatar,
              gender: participant.gender,
            },
            eventSnapshot: {
              title: firstEvent.title,
              date: firstEvent.date,
              time: firstEvent.time,
              location: firstEvent.location,
              type: firstEvent.type,
              roleName: role.name,
              roleDescription: role.description,
            },
            status: "active",
            notes: `Excited to participate in ${role.name}!`,
            registeredBy: participant._id,
          });

          await registration.save();
          console.log(
            `   ✅ Registered ${participant.username} for ${role.name}`
          );
        } catch (error: any) {
          console.error(
            `   ❌ Failed to register ${participant.username}:`,
            error.message
          );
        }
      }
    }

    console.log("\n🎉 Sample data creation completed!");
    console.log(`📊 Summary:`);
    console.log(`   Users created: ${createdUsers.length}`);
    console.log(`   Events created: ${createdEvents.length}`);
    console.log(
      `   Sample registrations: ${Math.min(createdUsers.length - 1, 3)}`
    );

    console.log("\n👤 Test Accounts (use these to login):");
    console.log("   🔑 Super Admin: john_doe / Password123!");
    console.log("   🔑 Leader: jane_smith / Password123!");
    console.log("   🔑 Admin: mike_wilson / Password123!");
    console.log("   🔑 Participant: david_garcia / Password123!");
  } catch (error: any) {
    console.error("❌ Error creating sample data:", error);
  } finally {
    await mongoose.connection.close();
    console.log("📂 Database connection closed");
    process.exit(0);
  }
};

// Main execution
createSampleData();
