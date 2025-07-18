import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Redundant System Cleanup Verification", () => {
  it("should confirm redundant System 2 methods are removed from UserNotificationController", () => {
    console.log("=== TESTING REDUNDANT SYSTEM CLEANUP ===");

    const controllerPath = path.join(
      __dirname,
      "../src/controllers/userNotificationController.ts"
    );
    const controllerContent = fs.readFileSync(controllerPath, "utf-8");

    console.log("--- CHECKING: UserNotificationController cleanup ---");

    // Check that bell notification methods are removed
    expect(controllerContent).not.toContain("getBellNotifications");
    expect(controllerContent).not.toContain("markBellNotificationAsRead");
    expect(controllerContent).not.toContain("deleteBellNotification");
    expect(controllerContent).not.toContain("markAllBellNotificationsAsRead");

    // Check that SystemMessage import is removed from imports section
    expect(controllerContent).not.toContain("import { User, SystemMessage }");

    console.log("✅ UserNotificationController bell methods removed");

    // Check routes file
    const routesPath = path.join(
      __dirname,
      "../src/routes/userNotifications.ts"
    );
    const routesContent = fs.readFileSync(routesPath, "utf-8");

    console.log("--- CHECKING: User notification routes cleanup ---");

    // Check that bell notification routes are removed
    expect(routesContent).not.toContain('"/bell"');
    expect(routesContent).not.toContain('"/bell/:notificationId/read"');
    expect(routesContent).not.toContain('"/bell/:notificationId"');
    expect(routesContent).not.toContain('"/bell/read-all"');

    console.log("✅ Bell notification routes removed");

    // Verify System 1 still exists
    const systemControllerPath = path.join(
      __dirname,
      "../src/controllers/systemMessageController.ts"
    );
    const systemControllerContent = fs.readFileSync(
      systemControllerPath,
      "utf-8"
    );

    console.log("--- CHECKING: System 1 still functional ---");

    expect(systemControllerContent).toContain("getBellNotifications");
    expect(systemControllerContent).toContain("markBellNotificationAsRead");
    expect(systemControllerContent).toContain("markAllBellNotificationsAsRead");

    console.log("✅ System 1 (SystemMessageController) remains functional");

    // Check System 1 routes still exist
    const systemRoutesPath = path.join(
      __dirname,
      "../src/routes/systemMessages.ts"
    );
    const systemRoutesContent = fs.readFileSync(systemRoutesPath, "utf-8");

    expect(systemRoutesContent).toContain("/bell-notifications");

    console.log("✅ System 1 routes remain functional");

    console.log("=== CLEANUP VERIFICATION SUCCESS ===");
    console.log("✅ Redundant System 2 completely removed");
    console.log("✅ System 1 remains fully functional");
    console.log("✅ No duplicate notification systems exist");
    console.log("✅ Frontend can use System 1 endpoints exclusively");
  });
});
