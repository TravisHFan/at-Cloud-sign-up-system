import { BaseApiClient } from "./common";

export type RefundRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired";

export type RefundRequestUserDecision =
  | "unenroll_without_refund"
  | "stay_enrolled";

export type RefundRequestDetail = {
  id: string;
  status: RefundRequestStatus;
  source: "purchase_history" | "program_unenroll";
  purchaseType: "program" | "event" | "membership";
  itemTitle: string;
  refundAmount: number;
  reason?: string;
  requestedAt: string;
  requestExpiresAt: string;
  decidedAt?: string;
  decisionNote?: string;
  userDecision?: RefundRequestUserDecision;
  userDecidedAt?: string;
  requester?: {
    id: string;
    name: string;
    email: string;
    role: string;
    roleInAtCloud?: string;
  };
  decidedBy?: {
    id: string;
    name: string;
    email: string;
    role: string;
    roleInAtCloud?: string;
    display: string;
  };
  purchase?: {
    id: string;
    orderNumber: string;
    purchaseDate: string;
    status: string;
    finalPrice: number;
    isClassRep?: boolean;
  };
};

class RefundRequestsApiClient extends BaseApiClient {
  async getById(id: string): Promise<RefundRequestDetail> {
    const res = await this.request<RefundRequestDetail>(
      `/refund-requests/${id}`,
    );
    if (!res.data) {
      throw new Error(res.message || "Failed to load refund request.");
    }
    return res.data;
  }

  async approve(id: string): Promise<RefundRequestDetail> {
    const res = await this.request<RefundRequestDetail>(
      `/refund-requests/${id}/approve`,
      { method: "POST" },
    );
    if (!res.data) {
      throw new Error(res.message || "Failed to approve refund request.");
    }
    return res.data;
  }

  async reject(id: string, note?: string): Promise<RefundRequestDetail> {
    const res = await this.request<RefundRequestDetail>(
      `/refund-requests/${id}/reject`,
      {
        method: "POST",
        body: JSON.stringify({ note }),
      },
    );
    if (!res.data) {
      throw new Error(res.message || "Failed to reject refund request.");
    }
    return res.data;
  }

  async submitUserDecision(
    id: string,
    decision: RefundRequestUserDecision,
  ): Promise<RefundRequestDetail> {
    const res = await this.request<RefundRequestDetail>(
      `/refund-requests/${id}/user-decision`,
      {
        method: "POST",
        body: JSON.stringify({ decision }),
      },
    );
    if (!res.data) {
      throw new Error(res.message || "Failed to save your decision.");
    }
    return res.data;
  }
}

const refundRequestsApiClient = new RefundRequestsApiClient();

export const refundRequestsService = {
  getById: (id: string) => refundRequestsApiClient.getById(id),
  approve: (id: string) => refundRequestsApiClient.approve(id),
  reject: (id: string, note?: string) =>
    refundRequestsApiClient.reject(id, note),
  submitUserDecision: (
    id: string,
    decision: RefundRequestUserDecision,
  ) => refundRequestsApiClient.submitUserDecision(id, decision),
};
