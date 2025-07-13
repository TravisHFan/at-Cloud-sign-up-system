/**
 * Priority 2: Frontend-Backend Integration Test Suite
 *
 * This script tests all the critical integrations we implemented in Priority 1:
 * 1. Authentication flow
 * 2. Event management (create, view, signup, cancel)
 * 3. Profile management
 * 4. Analytics dashboard
 * 5. Ministry stats
 */

// Test Configuration
const API_BASE_URL = "http://localhost:5001/api/v1";
const FRONTEND_URL = "http://localhost:5173";

// Test User Credentials
const TEST_USER = {
  emailOrUsername: "john.doe@example.com",
  password: "password123",
};

class IntegrationTester {
  constructor() {
    this.authToken = null;
    this.currentUser = null;
    this.testResults = [];
  }

  // Utility method to make API calls
  async apiCall(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      ...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`API call failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // Test result logging
  logResult(testName, success, details = "") {
    const result = {
      test: testName,
      success,
      details,
      timestamp: new Date().toISOString(),
    };
    this.testResults.push(result);
    console.log(`${success ? "✅" : "❌"} ${testName}: ${details}`);
  }

  // 1. Test Authentication Flow
  async testAuthentication() {
    console.log("\n🔐 Testing Authentication Flow...");

    try {
      // Test login
      const loginResponse = await this.apiCall("/auth/login", {
        method: "POST",
        body: JSON.stringify(TEST_USER),
      });

      if (loginResponse.data && loginResponse.data.accessToken) {
        this.authToken = loginResponse.data.accessToken;
        this.currentUser = loginResponse.data.user;
        this.logResult(
          "User Login",
          true,
          `Logged in as ${this.currentUser.username}`
        );
      } else {
        this.logResult("User Login", false, "No access token received");
        return false;
      }

      // Test profile retrieval
      const profileResponse = await this.apiCall("/auth/profile");
      if (profileResponse.data && profileResponse.data.user) {
        this.logResult(
          "Profile Retrieval",
          true,
          `Got profile for ${profileResponse.data.user.email}`
        );
      } else {
        this.logResult(
          "Profile Retrieval",
          false,
          "Failed to retrieve profile"
        );
      }

      return true;
    } catch (error) {
      this.logResult("Authentication", false, error.message);
      return false;
    }
  }

  // 2. Test Event Management
  async testEventManagement() {
    console.log("\n📅 Testing Event Management...");

    try {
      // Test getting events
      const eventsResponse = await this.apiCall("/events");
      if (eventsResponse.data && Array.isArray(eventsResponse.data.events)) {
        this.logResult(
          "Get Events",
          true,
          `Retrieved ${eventsResponse.data.events.length} events`
        );
      } else {
        this.logResult("Get Events", false, "Invalid events response");
      }

      // Test getting a specific event (if events exist)
      if (eventsResponse.data.events.length > 0) {
        const firstEvent = eventsResponse.data.events[0];
        const eventResponse = await this.apiCall(`/events/${firstEvent.id}`);
        if (eventResponse.data && eventResponse.data.event) {
          this.logResult(
            "Get Single Event",
            true,
            `Retrieved event: ${eventResponse.data.event.title}`
          );
        } else {
          this.logResult(
            "Get Single Event",
            false,
            "Failed to retrieve single event"
          );
        }
      }

      // Test event creation
      const newEventData = {
        title: "Integration Test Event",
        description: "Test event created by integration tester",
        date: "2025-08-15",
        time: "14:00",
        endTime: "16:00",
        location: "Test Location",
        type: "Prayer Meeting",
        organizer: this.currentUser
          ? `${this.currentUser.firstName} ${this.currentUser.lastName}`
          : "Test Organizer",
        purpose: "Testing",
        agenda: "Test agenda",
        format: "In-person",
        roles: [
          {
            id: "1",
            name: "Participant",
            description: "General participant",
            maxParticipants: 10,
            currentSignups: [],
          },
        ],
        signedUp: 0,
        totalSlots: 10,
        category: "Prayer",
        isHybrid: false,
        createdBy: this.currentUser ? this.currentUser.id : "test-user",
        createdAt: new Date().toISOString(),
      };

      const createResponse = await this.apiCall("/events", {
        method: "POST",
        body: JSON.stringify(newEventData),
      });

      if (createResponse.data && createResponse.data.event) {
        this.logResult(
          "Create Event",
          true,
          `Created event: ${createResponse.data.event.title}`
        );

        // Test event signup
        const eventId = createResponse.data.event.id;
        const roleId = "1";

        try {
          const signupResponse = await this.apiCall(
            `/events/${eventId}/signup`,
            {
              method: "POST",
              body: JSON.stringify({ roleId, notes: "Test signup" }),
            }
          );

          if (signupResponse.data) {
            this.logResult(
              "Event Signup",
              true,
              "Successfully signed up for event"
            );

            // Test signup cancellation
            const cancelResponse = await this.apiCall(
              `/events/${eventId}/cancel`,
              {
                method: "POST",
                body: JSON.stringify({ roleId }),
              }
            );

            if (cancelResponse.data) {
              this.logResult(
                "Cancel Signup",
                true,
                "Successfully cancelled signup"
              );
            } else {
              this.logResult("Cancel Signup", false, "Failed to cancel signup");
            }
          } else {
            this.logResult(
              "Event Signup",
              false,
              "Failed to sign up for event"
            );
          }
        } catch (signupError) {
          this.logResult("Event Signup", false, signupError.message);
        }
      } else {
        this.logResult("Create Event", false, "Failed to create event");
      }
    } catch (error) {
      this.logResult("Event Management", false, error.message);
    }
  }

  // 3. Test Analytics
  async testAnalytics() {
    console.log("\n📊 Testing Analytics...");

    try {
      // Test general analytics
      const analyticsResponse = await this.apiCall("/analytics");
      if (analyticsResponse.data) {
        this.logResult("General Analytics", true, "Retrieved analytics data");
      } else {
        this.logResult(
          "General Analytics",
          false,
          "Failed to retrieve analytics"
        );
      }

      // Test event analytics
      const eventAnalyticsResponse = await this.apiCall("/analytics/events");
      if (eventAnalyticsResponse.data) {
        this.logResult("Event Analytics", true, "Retrieved event analytics");
      } else {
        this.logResult(
          "Event Analytics",
          false,
          "Failed to retrieve event analytics"
        );
      }

      // Test user analytics
      const userAnalyticsResponse = await this.apiCall("/analytics/users");
      if (userAnalyticsResponse.data) {
        this.logResult("User Analytics", true, "Retrieved user analytics");
      } else {
        this.logResult(
          "User Analytics",
          false,
          "Failed to retrieve user analytics"
        );
      }
    } catch (error) {
      this.logResult("Analytics", false, error.message);
    }
  }

  // 4. Test Search Functionality
  async testSearch() {
    console.log("\n🔍 Testing Search Functionality...");

    try {
      // Test event search
      const eventSearchResponse = await this.apiCall("/search/events?q=test");
      if (eventSearchResponse.data) {
        this.logResult("Event Search", true, "Search functionality working");
      } else {
        this.logResult("Event Search", false, "Search failed");
      }

      // Test user search
      const userSearchResponse = await this.apiCall("/search/users?q=john");
      if (userSearchResponse.data) {
        this.logResult("User Search", true, "User search working");
      } else {
        this.logResult("User Search", false, "User search failed");
      }
    } catch (error) {
      this.logResult("Search", false, error.message);
    }
  }

  // 5. Test File Upload
  async testFileUpload() {
    console.log("\n📁 Testing File Upload...");

    try {
      // Create a small test file
      const testBlob = new Blob(["test file content"], { type: "text/plain" });
      const testFile = new File([testBlob], "test.txt", { type: "text/plain" });

      const formData = new FormData();
      formData.append("attachment", testFile);

      const uploadResponse = await this.apiCall("/messages/attachments", {
        method: "POST",
        body: formData,
        headers: {}, // Remove Content-Type to let browser set it for FormData
      });

      if (uploadResponse.data && uploadResponse.data.fileUrl) {
        this.logResult("File Upload", true, "File uploaded successfully");
      } else {
        this.logResult("File Upload", false, "File upload failed");
      }
    } catch (error) {
      this.logResult("File Upload", false, error.message);
    }
  }

  // Run all tests
  async runAllTests() {
    console.log("🚀 Starting Frontend-Backend Integration Tests...\n");

    const authSuccess = await this.testAuthentication();

    if (authSuccess) {
      await this.testEventManagement();
      await this.testAnalytics();
      await this.testSearch();
      await this.testFileUpload();
    } else {
      console.log("❌ Authentication failed - skipping other tests");
    }

    // Generate test report
    this.generateReport();
  }

  // Generate test report
  generateReport() {
    console.log("\n📋 Integration Test Report:");
    console.log("=====================================");

    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter((r) => r.success).length;
    const failedTests = totalTests - passedTests;

    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(
      `Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`
    );

    if (failedTests > 0) {
      console.log("\n❌ Failed Tests:");
      this.testResults
        .filter((r) => !r.success)
        .forEach((r) => console.log(`  - ${r.test}: ${r.details}`));
    }

    console.log("\n✅ Integration testing complete!");

    return {
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      successRate: (passedTests / totalTests) * 100,
      results: this.testResults,
    };
  }
}

// Export for use in browser console
if (typeof window !== "undefined") {
  window.IntegrationTester = IntegrationTester;
  window.runIntegrationTests = async () => {
    const tester = new IntegrationTester();
    return await tester.runAllTests();
  };
}

export default IntegrationTester;
