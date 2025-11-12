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

  // Get program analytics
  static async getProgramAnalytics(req: Request, res: Response): Promise<void> {
    const { default: ProgramAnalyticsController } = await import(
      "./analytics/ProgramAnalyticsController"
    );
    return ProgramAnalyticsController.getProgramAnalytics(req, res);
  }

  // Get donation analytics
  static async getDonationAnalytics(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: DonationAnalyticsController } = await import(
      "./analytics/DonationAnalyticsController"
    );
    return DonationAnalyticsController.getDonationAnalytics(req, res);
  }

  // Get financial summary (programs + donations)
  static async getFinancialSummary(req: Request, res: Response): Promise<void> {
    const { default: FinancialAnalyticsController } = await import(
      "./analytics/FinancialAnalyticsController"
    );
    return FinancialAnalyticsController.getFinancialSummary(req, res);
  }

  // Get financial trends
  static async getTrends(req: Request, res: Response): Promise<void> {
    const { default: TrendsAnalyticsController } = await import(
      "./analytics/TrendsAnalyticsController"
    );
    return TrendsAnalyticsController.getTrends(req, res);
  }
}
