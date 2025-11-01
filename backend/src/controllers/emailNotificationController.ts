import { Request, Response } from "express";

export class EmailNotificationController {
  /**
   * Send event creation notifications to all active users
   * POST /api/notifications/event-created
   */
  static async sendEventCreatedNotification(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: EventCreatedController } = await import(
      "./emailNotifications/EventCreatedController"
    );
    return EventCreatedController.sendEventCreatedNotification(req, res);
  }

  /**
   * Send system authorization level change notifications
   * POST /api/notifications/system-authorization-change
   *
   * NOW WITH UNIFIED MESSAGING: Email + System Message + Bell Notification
   */
  static async sendSystemAuthorizationChangeNotification(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: SystemAuthorizationChangeController } = await import(
      "./emailNotifications/SystemAuthorizationChangeController"
    );
    return SystemAuthorizationChangeController.sendSystemAuthorizationChangeNotification(
      req,
      res
    );
  }

  /**
   * Send @Cloud ministry role change notifications
   * POST /api/notifications/atcloud-role-change
   */
  static async sendAtCloudRoleChangeNotification(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: AtCloudRoleChangeController } = await import(
      "./emailNotifications/AtCloudRoleChangeController"
    );
    return AtCloudRoleChangeController.sendAtCloudRoleChangeNotification(
      req,
      res
    );
  }

  /**
   * Send new leader signup notification to admins
   * POST /api/notifications/new-leader-signup
   */
  static async sendNewLeaderSignupNotification(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: NewLeaderSignupController } = await import(
      "./emailNotifications/NewLeaderSignupController"
    );
    return NewLeaderSignupController.sendNewLeaderSignupNotification(req, res);
  }

  /**
   * Send co-organizer assignment notification
   * POST /api/notifications/co-organizer-assigned
   */
  static async sendCoOrganizerAssignedNotification(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: CoOrganizerAssignedController } = await import(
      "./emailNotifications/CoOrganizerAssignedController"
    );
    return CoOrganizerAssignedController.sendCoOrganizerAssignedNotification(
      req,
      res
    );
  }

  /**
   * Send event reminder notifications to participants
   * POST /api/notifications/event-reminder
   */
  static async sendEventReminderNotification(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: EventReminderController } = await import(
      "./emailNotifications/EventReminderController"
    );
    return EventReminderController.sendEventReminderNotification(req, res);
  }
}
