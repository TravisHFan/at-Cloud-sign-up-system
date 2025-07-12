/**
 * Activity Testing Utilities
 * Run these functions in the browser console to test different activity types
 */

import { activityService, ActivityTrackers } from "../services/activityService";
import { CURRENT_USER } from "../data/mockUserData";

// Declare global functions for browser console access
declare global {
  interface Window {
    // Existing welcome message functions
    testWelcomeMessage: () => void;
    resetWelcomeStatus: () => void;

    // New activity testing functions
    testActivity: {
      login: () => void;
      eventSignup: () => void;
      profileUpdate: () => void;
      passwordChange: () => void;
      eventCreate: () => void;
      chatMessage: () => void;
      generateRandomActivity: () => void;
      clearAllActivities: () => void;
      showAllActivities: () => void;
    };
  }
}

// Test different activity types
const testLogin = () => {
  ActivityTrackers.trackLogin(CURRENT_USER, {
    ip: "192.168.1.100",
    browser: "Chrome",
    timestamp: new Date().toISOString(),
  });
  console.log("✅ Login activity generated");
};

const testEventSignup = () => {
  const eventNames = [
    "Bible Study Series",
    "Youth Ministry Retreat",
    "Community Service Day",
    "Worship Night",
    "Prayer Meeting",
    "Leadership Training",
  ];

  const randomEvent = eventNames[Math.floor(Math.random() * eventNames.length)];

  ActivityTrackers.trackEventSignup(
    CURRENT_USER,
    randomEvent,
    `event_${Math.random().toString(36).substr(2, 9)}`
  );
  console.log(`✅ Event signup activity generated: ${randomEvent}`);
};

const testProfileUpdate = () => {
  const fieldGroups = [
    ["phone", "address"],
    ["email", "notifications"],
    ["avatar", "bio"],
    ["church", "occupation"],
    ["preferences", "settings"],
  ];

  const randomFields =
    fieldGroups[Math.floor(Math.random() * fieldGroups.length)];

  ActivityTrackers.trackProfileUpdate(CURRENT_USER, randomFields);
  console.log(
    `✅ Profile update activity generated: ${randomFields.join(", ")}`
  );
};

const testPasswordChange = () => {
  ActivityTrackers.trackPasswordChange(CURRENT_USER);
  console.log("✅ Password change activity generated");
};

const testEventCreate = () => {
  const eventNames = [
    "New Member Orientation",
    "Easter Celebration",
    "Christmas Service",
    "Summer Camp",
    "Mission Trip",
    "Conference 2025",
  ];

  const randomEvent = eventNames[Math.floor(Math.random() * eventNames.length)];

  ActivityTrackers.trackEventCreation(
    CURRENT_USER,
    randomEvent,
    `event_${Math.random().toString(36).substr(2, 9)}`
  );
  console.log(`✅ Event creation activity generated: ${randomEvent}`);
};

const testChatMessage = () => {
  const chatNames = [
    "Youth Ministry",
    "Leadership Team",
    "Worship Team",
    "General Discussion",
    "Prayer Requests",
    "Event Planning",
  ];

  const randomChat = chatNames[Math.floor(Math.random() * chatNames.length)];

  ActivityTrackers.trackChatMessage(
    CURRENT_USER,
    randomChat,
    `chat_${Math.random().toString(36).substr(2, 9)}`
  );
  console.log(`✅ Chat message activity generated: ${randomChat}`);
};

const generateRandomActivity = () => {
  const activities = [
    testLogin,
    testEventSignup,
    testProfileUpdate,
    testPasswordChange,
    testEventCreate,
    testChatMessage,
  ];

  const randomActivity =
    activities[Math.floor(Math.random() * activities.length)];
  randomActivity();
};

const clearAllActivities = () => {
  activityService.clearActivities();
  console.log("🗑️ All activities cleared");
};

const showAllActivities = () => {
  const activities = activityService.getActivities({ limit: 20 });
  console.log("📋 Current Activities:");
  console.table(
    activities.map((a) => ({
      Type: a.type,
      Title: a.title,
      Time: a.timestamp.toLocaleTimeString(),
      Priority: a.priority,
      Public: a.isPublic ? "Yes" : "No",
    }))
  );
};

// Make functions available globally for testing
if (typeof window !== "undefined") {
  window.testActivity = {
    login: testLogin,
    eventSignup: testEventSignup,
    profileUpdate: testProfileUpdate,
    passwordChange: testPasswordChange,
    eventCreate: testEventCreate,
    chatMessage: testChatMessage,
    generateRandomActivity: generateRandomActivity,
    clearAllActivities: clearAllActivities,
    showAllActivities: showAllActivities,
  };

  console.log("🧪 Activity testing functions loaded!");
  console.log("Available commands:");
  console.log("- testActivity.login()           → Generate login activity");
  console.log("- testActivity.eventSignup()     → Generate event signup");
  console.log("- testActivity.profileUpdate()   → Generate profile update");
  console.log("- testActivity.passwordChange()  → Generate password change");
  console.log("- testActivity.eventCreate()     → Generate event creation");
  console.log("- testActivity.chatMessage()     → Generate chat message");
  console.log(
    "- testActivity.generateRandomActivity() → Generate random activity"
  );
  console.log("- testActivity.clearAllActivities() → Clear all activities");
  console.log("- testActivity.showAllActivities() → Show current activities");
}
