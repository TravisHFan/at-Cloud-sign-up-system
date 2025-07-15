const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Define schemas inline for script execution
const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: String,
    dateTime: { type: Date, required: true },
    endDateTime: Date,
    location: String,
    status: {
      type: String,
      enum: ["upcoming", "ongoing", "completed", "cancelled"],
      default: "upcoming",
    },
    roles: [
      {
        roleName: String,
        requirements: String,
        spotsAvailable: Number,
        spotsNeeded: Number,
        participants: [mongoose.Schema.Types.ObjectId],
      },
    ],
    organizers: [mongoose.Schema.Types.ObjectId],
    eventImages: [String],
    maxParticipants: Number,
    registrationDeadline: Date,
    tags: [String],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Event = mongoose.model("Event", eventSchema);

async function createSampleEvents() {
  try {
    // Connect to MongoDB
    await mongoose.connect("mongodb://localhost:27017/atcloud-signup");
    console.log("✅ Connected to MongoDB");

    // Get sample organizer user
    const User = mongoose.model("User");
    const organizer = await User.findOne({
      role: { $in: ["Super Admin", "Administrator", "Leader"] },
    });

    if (!organizer) {
      console.log("❌ No organizer user found");
      return;
    }

    const sampleEvents = [
      {
        title: "Sunday Morning Service",
        description:
          "Join us for our weekly Sunday morning worship service with communion and prayer.",
        dateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        endDateTime: new Date(
          Date.now() + 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000
        ), // 2 hours later
        location: "@Cloud Main Campus - Sanctuary",
        roles: [
          {
            roleName: "Worship Team Member",
            requirements: "Musical instrument skills or vocal ability",
            spotsAvailable: 8,
            spotsNeeded: 8,
            participants: [],
          },
          {
            roleName: "Usher",
            requirements: "Friendly attitude and willingness to help",
            spotsAvailable: 6,
            spotsNeeded: 6,
            participants: [],
          },
          {
            roleName: "Technical Support",
            requirements: "Experience with audio/video equipment",
            spotsAvailable: 3,
            spotsNeeded: 3,
            participants: [],
          },
        ],
        organizers: [organizer._id],
        maxParticipants: 200,
        registrationDeadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        tags: ["worship", "weekly", "service"],
        status: "upcoming",
      },
      {
        title: "Youth Group Meeting",
        description:
          "Monthly youth gathering with games, discussion, and fellowship for ages 13-18.",
        dateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
        endDateTime: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000
        ), // 3 hours later
        location: "@Cloud Youth Center",
        roles: [
          {
            roleName: "Youth Leader",
            requirements: "Experience working with teenagers",
            spotsAvailable: 2,
            spotsNeeded: 2,
            participants: [],
          },
          {
            roleName: "Activity Coordinator",
            requirements: "Creative and energetic personality",
            spotsAvailable: 4,
            spotsNeeded: 4,
            participants: [],
          },
          {
            roleName: "Participant",
            requirements: "Ages 13-18",
            spotsAvailable: 30,
            spotsNeeded: 15,
            participants: [],
          },
        ],
        organizers: [organizer._id],
        maxParticipants: 40,
        registrationDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        tags: ["youth", "fellowship", "monthly"],
        status: "upcoming",
      },
      {
        title: "Community Outreach - Food Drive",
        description:
          "Help organize and distribute food to families in need in our local community.",
        dateTime: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
        endDateTime: new Date(
          Date.now() + 10 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000
        ), // 4 hours later
        location: "@Cloud Community Center",
        roles: [
          {
            roleName: "Volunteer Coordinator",
            requirements: "Organizational skills and leadership experience",
            spotsAvailable: 2,
            spotsNeeded: 2,
            participants: [],
          },
          {
            roleName: "Food Sorter",
            requirements: "Physical ability to lift and sort items",
            spotsAvailable: 12,
            spotsNeeded: 12,
            participants: [],
          },
          {
            roleName: "Distribution Helper",
            requirements: "Friendly demeanor and willingness to serve",
            spotsAvailable: 8,
            spotsNeeded: 8,
            participants: [],
          },
        ],
        organizers: [organizer._id],
        maxParticipants: 25,
        registrationDeadline: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
        tags: ["outreach", "community", "service"],
        status: "upcoming",
      },
      {
        title: "Bible Study Group",
        description:
          "Weekly Bible study focusing on the Book of Romans with discussion and prayer.",
        dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
        endDateTime: new Date(
          Date.now() + 2 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000
        ), // 1.5 hours later
        location: "@Cloud Fellowship Hall",
        roles: [
          {
            roleName: "Study Leader",
            requirements: "Biblical knowledge and teaching experience",
            spotsAvailable: 1,
            spotsNeeded: 1,
            participants: [],
          },
          {
            roleName: "Participant",
            requirements: "Desire to study God's word",
            spotsAvailable: 20,
            spotsNeeded: 10,
            participants: [],
          },
        ],
        organizers: [organizer._id],
        maxParticipants: 25,
        registrationDeadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        tags: ["bible-study", "weekly", "education"],
        status: "upcoming",
      },
      {
        title: "Christmas Concert Preparation",
        description:
          "Rehearsal for the upcoming Christmas concert. All choir members and musicians welcome.",
        dateTime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks from now
        endDateTime: new Date(
          Date.now() + 14 * 24 * 60 * 60 * 1000 + 2.5 * 60 * 60 * 1000
        ), // 2.5 hours later
        location: "@Cloud Sanctuary",
        roles: [
          {
            roleName: "Choir Member",
            requirements: "Ability to read music and sing in harmony",
            spotsAvailable: 25,
            spotsNeeded: 20,
            participants: [],
          },
          {
            roleName: "Musician",
            requirements: "Proficiency with instrument",
            spotsAvailable: 8,
            spotsNeeded: 6,
            participants: [],
          },
          {
            roleName: "Sound Technician",
            requirements: "Experience with sound equipment",
            spotsAvailable: 2,
            spotsNeeded: 2,
            participants: [],
          },
        ],
        organizers: [organizer._id],
        maxParticipants: 40,
        registrationDeadline: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
        tags: ["music", "christmas", "performance"],
        status: "upcoming",
      },
    ];

    // Create events
    for (const eventData of sampleEvents) {
      const existingEvent = await Event.findOne({ title: eventData.title });
      if (!existingEvent) {
        const event = new Event(eventData);
        await event.save();
        console.log(`✅ Created event: ${eventData.title}`);
      } else {
        console.log(`⏭️  Event already exists: ${eventData.title}`);
      }
    }

    console.log("\n🎉 Sample events created successfully!");
    console.log("\n📋 Available Events:");
    const events = await Event.find({}).select(
      "title dateTime location status"
    );
    events.forEach((event) => {
      console.log(
        `- ${event.title} (${new Date(
          event.dateTime
        ).toLocaleDateString()}) - ${event.status}`
      );
    });
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.connection.close();
    console.log("📂 Database connection closed");
    process.exit(0);
  }
}

createSampleEvents();
