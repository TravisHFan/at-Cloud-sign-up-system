import { Request, Response } from "express";

export class AnalyticsController {
  // Get general analytics overview
  static async getAnalytics(req: Request, res: Response): Promise<void> {
    const { default: OverviewAnalyticsController } = await import(
      "./analytics/OverviewAnalyticsController"
    );
    return OverviewAnalyticsController.getAnalytics(req, res);
  }

  // Get user analytics
  static async getUserAnalytics(req: Request, res: Response): Promise<void> {
    const { default: UserAnalyticsController } = await import(
      "./analytics/UserAnalyticsController"
    );
    return UserAnalyticsController.getUserAnalytics(req, res);
  }

  // Get event analytics
  static async getEventAnalytics(req: Request, res: Response): Promise<void> {
    const { default: EventAnalyticsController } = await import(
      "./analytics/EventAnalyticsController"
    );
    return EventAnalyticsController.getEventAnalytics(req, res);
  }

  // Get engagement analytics
  static async getEngagementAnalytics(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: EngagementAnalyticsController } = await import(
      "./analytics/EngagementAnalyticsController"
    );
    return EngagementAnalyticsController.getEngagementAnalytics(req, res);
  }

  // Export analytics data
  static async exportAnalytics(req: Request, res: Response): Promise<void> {
    const { default: ExportAnalyticsController } = await import(
      "./analytics/ExportAnalyticsController"
    );
    return ExportAnalyticsController.exportAnalytics(req, res);
  }
}
