import { BaseApiClient } from "./common";

/**
 * Feedback API Service
 * Handles feedback submission
 */
class FeedbackApiClient extends BaseApiClient {
  /**
   * Submit user feedback
   */
  async submitFeedback(feedbackData: {
    type: string;
    subject: string;
    message: string;
    includeContact?: boolean;
  }): Promise<void> {
    await this.request("/feedback", {
      method: "POST",
      body: JSON.stringify(feedbackData),
    });
  }
}

// Export singleton instance
const feedbackApiClient = new FeedbackApiClient();

// Export service methods
export const feedbackService = {
  submitFeedback: (
    data: Parameters<typeof feedbackApiClient.submitFeedback>[0]
  ) => feedbackApiClient.submitFeedback(data),
};
